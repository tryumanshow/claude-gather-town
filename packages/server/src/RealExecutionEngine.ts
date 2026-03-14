import type { ServerMessage, ZoneName, AgentPermissionPayload, AgentState } from '@theater/shared';
import { AGENT_ROSTER, TIMING, getZoneCenter } from '@theater/shared';
import type { ParsedCommand } from './CommandParser.js';
import type { SimulationEngine } from './SimulationEngine.js';
import { AgentSession } from './anthropic/AgentSession.js';
import { pickAgentsForTask } from './roster/pickAgents.js';
import { AwarenessManager } from './AwarenessManager.js';
import { Brain } from './roster/Brain.js';

export interface RealExecutionConfig {
  workingDirectory: string;
  model?: string;
  permissionMode?: 'acceptEdits' | 'bypassPermissions';
  onPermissionRequest?: (req: AgentPermissionPayload) => Promise<boolean>;
}

/** Discussion lines for standup / meeting */
const STANDUP_POOL = [
  "Got it, I'll handle my part.",
  "Heading to my desk now.",
  "I know what to do — let me start.",
  "I'll report back when done.",
  "On it!",
];

const DISCUSSION_POOL = [
  "Let's define the scope first.",
  "We should follow existing code patterns.",
  "Let's start with the API structure.",
  "I'll take this module.",
  "We should write tests too.",
  "Any performance concerns?",
  "Don't forget documentation.",
  "Looks like we need component separation.",
  "Let's nail down the types first.",
  "We need to consider error handling.",
];

const FROM_SCRATCH_DISCUSSION_POOL = [
  "No existing code here. Let's design from scratch.",
  "Let's set up the folder structure first.",
  "I'll start by defining the base interfaces.",
  "Let's draw out the architecture first.",
  "Since we're starting fresh, let's follow best practices.",
];

const REPORT_POOL = [
  "My part is done — here's what I did.",
  "Finished! Reporting back to Morgan.",
  "Task complete on my end.",
  "Done! Let me share my results.",
];

const CHECKIN_POOL = [
  "Quick progress check — how's everyone doing?",
  "Let's sync up on what we have so far.",
  "Halfway there — any blockers?",
];

const HANDOFF_POOL = [
  "Here's what I've got so far — your turn.",
  "Passing this to you — please continue.",
  "Done with my part, handing off.",
];

export class RealExecutionEngine {
  private config: RealExecutionConfig;
  private activeSessions: Map<string, AgentSession> = new Map();
  private awarenessManager: AwarenessManager = new AwarenessManager();
  private brain: Brain = new Brain();
  /** Track the last agent that interacted with the user (for conversation continuity) */
  private lastChatAgentId: string | null = null;
  /** SDK session IDs per agent — enables multi-turn conversation resume */
  private agentSessionIds: Map<string, string> = new Map();
  /** Set to true when stop is requested — checked by delay() to abort flows */
  private cancelled = false;

  constructor(config: RealExecutionConfig) {
    this.config = config;
  }

  updateWorkingDirectory(path: string): void {
    this.config = { ...this.config, workingDirectory: path };
  }

  setPermissionHandler(handler: ((req: AgentPermissionPayload) => Promise<boolean>) | undefined): void {
    this.config = { ...this.config, onPermissionRequest: handler };
  }

  /** Main entry point — Brain classifies intent, then routes accordingly */
  async execute(
    command: ParsedCommand,
    simulation: SimulationEngine,
    playerPos: { x: number; y: number },
  ): Promise<void> {
    this.cancelled = false;
    simulation.log('info', 'Brain', `Analyzing: ${command.description}`);

    // Record user message in conversation history
    this.brain.addUserMessage(command.description);

    // Brain: lightweight SDK call — classifies intent + picks agent
    const decision = await this.brain.analyze(
      command.description,
      command.targetAgent,
      command.mode !== 'single' ? command.mode : undefined,
      this.lastChatAgentId ?? undefined,
    );

    const mainRoster = AGENT_ROSTER.find(a => a.id === decision.agentId) ?? AGENT_ROSTER[0];
    const agentId = `roster-${mainRoster.id}`;

    simulation.log('info', 'Brain', `Intent: ${decision.intent} → ${mainRoster.name} (${mainRoster.role})`);

    // ── Chat intent: respond directly ──
    if (decision.intent === 'chat') {
      const chatResponse = decision.response || 'Sure!';
      await this.handleChat(simulation, agentId, mainRoster, chatResponse, playerPos);
      this.brain.addAgentMessage(mainRoster.id, mainRoster.name, chatResponse);
      this.lastChatAgentId = mainRoster.id;
      return;
    }

    // ── Work intent: use the appropriate execution mode ──
    const mode = decision.mode || command.mode;

    if (mode === 'subagent' || mode === 'teams') {
      // Multi-agent: use Brain's team selection or fallback
      // Filter out Morgan — he's always the orchestrator, not a worker
      let picked = (decision.teamIds || [])
        .filter(id => id !== 'morgan')
        .map(id => AGENT_ROSTER.find(r => r.id === id))
        .filter((r): r is NonNullable<typeof r> => r != null);

      if (picked.length === 0) {
        picked = pickAgentsForTask(command.description, mode)
          .filter(r => r.id !== 'morgan');
      }

      const morganRoster = AGENT_ROSTER.find(a => a.id === 'morgan')!;
      const allParticipants = [...picked, morganRoster];
      const seatPositions = this.captureSeatPositions(allParticipants, simulation);

      // Announce team
      const morganId = 'roster-morgan';
      const names = picked.map(p => p.name).join(', ');
      const planText = decision.plan || `${mode === 'subagent' ? 'Distributing tasks to' : 'Assembling team:'} ${names}.`;
      this.emitNow(simulation, { type: 'agent:state', payload: { agentId: morganId, state: 'thinking', detail: 'Assembling team...' } });
      this.agentChat(morganId, planText, 3000, simulation, 'Morgan (CTO)');
      await this.delay(1500);
      this.emitNow(simulation, { type: 'agent:state', payload: { agentId: morganId, state: 'idle' } });

      if (mode === 'subagent') {
        // ★ Subagent: standup → scatter → work → individual report
        await this.runSubagentFlow(command, simulation, picked, morganRoster, seatPositions);
      } else {
        // ★ Teams: full meeting → relay handoffs → mid-checkin → final wrap-up
        await this.runTeamsFlow(command, simulation, picked, morganRoster, seatPositions);
      }
    } else {
      // Single agent work
      const seatPositions = this.captureSeatPositions([mainRoster], simulation);
      await this.executeSingleWork(command, simulation, agentId, mainRoster, seatPositions, playerPos);
    }

    // Track last agent for conversation continuity
    // For subagent/teams, Morgan is the orchestrator who last communicated
    this.lastChatAgentId = (mode === 'subagent' || mode === 'teams') ? 'morgan' : mainRoster.id;
  }

  // ══════════════════════════════════════════════════════════
  // Chat
  // ══════════════════════════════════════════════════════════

  /** Chat: agent walks to player, shows response, walks back */
  private async handleChat(
    simulation: SimulationEngine,
    agentId: string,
    roster: typeof AGENT_ROSTER[0],
    response: string,
    playerPos: { x: number; y: number },
  ): Promise<void> {
    const seatPositions = this.captureSeatPositions([roster], simulation);
    const seat = seatPositions.get(agentId);
    const targetX = playerPos.x - 40;
    const targetY = playerPos.y;
    const walkDelay = this.calcWalkDelay(seat?.x ?? 0, seat?.y ?? 0, targetX, targetY);

    // Walk to player
    this.moveAgent(agentId, targetX, targetY, roster.homeZone as ZoneName, simulation);
    await this.delay(walkDelay);

    // Show response
    this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state: 'communicating' } });
    this.agentChat(agentId, response, 4000, simulation, roster.name);
    await this.delay(3500);

    // Return to seat
    await this.returnToSeatAndWait(agentId, targetX, targetY, seatPositions, simulation);
  }

  // ══════════════════════════════════════════════════════════
  // Single Agent Work
  // ══════════════════════════════════════════════════════════

  private async executeSingleWork(
    command: ParsedCommand,
    simulation: SimulationEngine,
    agentId: string,
    mainRoster: typeof AGENT_ROSTER[0],
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
    playerPos: { x: number; y: number },
  ): Promise<void> {
    const taskId = `task-single-${Date.now()}`;
    this.emitTaskEvent(simulation, taskId, command.description, 'pending', agentId, mainRoster);

    const seat = seatPositions.get(agentId);
    const targetX = playerPos.x - 40;
    const targetY = playerPos.y;
    const walkDelay = this.calcWalkDelay(seat?.x ?? 0, seat?.y ?? 0, targetX, targetY);

    // Walk to player
    this.moveAgent(agentId, targetX, targetY, mainRoster.homeZone as ZoneName, simulation);
    await this.delay(walkDelay);

    const startText = `On it! ${mainRoster.name} is taking this task.`;
    this.agentChat(agentId, startText, 2000, simulation, mainRoster.name);
    await this.delay(800);

    // Start work
    this.emitTaskEvent(simulation, taskId, command.description, 'in_progress', agentId, mainRoster);
    this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state: 'thinking', detail: command.description } });

    const awarenessContext = await this.awarenessManager.buildSystemPromptContext(mainRoster.id, this.config.workingDirectory);
    const fromScratch = this.awarenessManager.getAwareness(mainRoster.id).isEmpty;

    const descWithContext = this.buildWorkDescription(agentId, command.description);
    const session = this.createAgentSession(agentId, mainRoster, descWithContext, 'single', awarenessContext, fromScratch);

    await this.runAgentSession(session, agentId, simulation);
    this.cleanupSpawnedAgents(session, simulation);

    // Done — announce completion and return to seat
    this.emitTaskEvent(simulation, taskId, command.description, 'completed', agentId, mainRoster);
    this.agentChat(agentId, 'Done! Task complete.', 2500, simulation, mainRoster.name);
    await this.delay(1500);
    await this.returnToSeatAndWait(agentId, targetX, targetY, seatPositions, simulation);
  }

  // ══════════════════════════════════════════════════════════
  // ★ Subagent Flow: Standup → Scatter → Work → Individual Report
  // ══════════════════════════════════════════════════════════

  private async runSubagentFlow(
    command: ParsedCommand,
    simulation: SimulationEngine,
    picked: typeof AGENT_ROSTER,
    morgan: typeof AGENT_ROSTER[0],
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
  ): Promise<void> {
    const morganId = 'roster-morgan';
    const allAgents = [morgan, ...picked];
    const allIds = allAgents.map(a => `roster-${a.id}`);
    const meetingPos = this.getMeetingPosition(allAgents.length);

    // ── Phase 1: Quick Standup (brief huddle) ──
    simulation.log('info', 'Subagent', 'Quick standup huddle...');
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'gather', agentIds: allIds, zone: 'spawn' as ZoneName, taskSummary: command.description },
    });

    await this.gatherAgentsToMeeting(allAgents, meetingPos, seatPositions, simulation);

    // Brief discuss (shorter than teams)
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'discuss', agentIds: allIds, zone: 'spawn' as ZoneName },
    });
    this.setAgentsState(allAgents, 'discussing', simulation);

    const briefText = `Quick brief — ${picked.map(p => p.name).join(', ')}, you know your tasks. Go!`;
    this.agentChat(morganId, briefText, 2500, simulation, 'Morgan');
    await this.delay(1200);

    // Each agent responds briefly
    const shuffledStandup = [...STANDUP_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(picked.length, 3); i++) {
      const aid = `roster-${picked[i].id}`;
      this.agentChat(aid, shuffledStandup[i], 1500, simulation, picked[i].name);
      await this.delay(600);
    }
    await this.delay(800);

    // ── Phase 2: Scatter — agents run back to their home desks ──
    simulation.log('info', 'Subagent', 'Agents scattering to desks...');
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'disperse', agentIds: allIds, zone: 'spawn' as ZoneName },
    });

    await this.scatterAgentsToSeats(allAgents, meetingPos, seatPositions, simulation);

    // Set agents to working state at their desks
    this.setAgentsState(picked, 'thinking', simulation, 'Working independently...');

    // ── Phase 3: Morgan orchestrates via SDK ──
    const taskId = `task-subagent-${Date.now()}`;
    this.emitTaskEvent(simulation, taskId, command.description, 'pending', morganId, morgan, 'subagent');
    this.emitTaskEvent(simulation, taskId, command.description, 'in_progress', morganId, morgan, 'subagent');

    const awarenessContext = await this.awarenessManager.buildSystemPromptContext(morgan.id, this.config.workingDirectory);
    const fromScratch = this.awarenessManager.getAwareness(morgan.id).isEmpty;

    const descWithContext = this.buildWorkDescription(morganId, command.description);
    const session = this.createAgentSession(morganId, morgan, descWithContext, 'subagent', awarenessContext, fromScratch, { maxTurns: 100, enableRosterAgents: true });

    const pickedIds = picked.map(p => `roster-${p.id}`);
    await this.runAgentSession(session, morganId, simulation, pickedIds);
    this.mergeSpawnedAgents(session, picked, seatPositions, simulation);
    this.cleanupSpawnedAgents(session, simulation);

    // ── Phase 4: Individual Report — each agent walks to Morgan one by one ──
    simulation.log('info', 'Subagent', 'Agents reporting back to Morgan...');
    const morganSeat = seatPositions.get(morganId)!;

    for (const p of picked) {
      const aid = `roster-${p.id}`;
      const pSeat = seatPositions.get(aid)!;

      // Agent walks to Morgan's desk
      this.moveAgent(aid, morganSeat.x + 40, morganSeat.y, 'planning' as ZoneName, simulation);
      const reportWalk = this.calcWalkDelay(pSeat.x, pSeat.y, morganSeat.x + 40, morganSeat.y);
      await this.delay(reportWalk);

      // Report
      const reportLine = REPORT_POOL[Math.floor(Math.random() * REPORT_POOL.length)];
      this.emitNow(simulation, { type: 'agent:state', payload: { agentId: aid, state: 'communicating' } });
      this.agentChat(aid, reportLine, 2000, simulation, p.name);
      await this.delay(1500);

      // Walk back to seat (fire-and-forget with overlap, idle set after delay)
      const pSeatBack = seatPositions.get(aid)!;
      this.moveAgent(aid, pSeatBack.x, pSeatBack.y, pSeatBack.zone, simulation);
      // Slight overlap — don't wait full walk for next agent
      await this.delay(600);
    }

    // Wait for last agent to finish walking, then set all picked to idle
    await this.delay(1000);
    this.setAgentsState(picked, 'idle', simulation);

    // ── Done ──
    const doneText = 'Subagent mode complete! All reports received.';
    this.emitTaskEvent(simulation, taskId, command.description, 'completed', morganId, morgan, 'subagent');
    this.agentChat(morganId, doneText, 3000, simulation, morgan.name);
    await this.delay(2000);
    const morganSeatPos = seatPositions.get(morganId)!;
    await this.returnToSeatAndWait(morganId, morganSeatPos.x, morganSeatPos.y, seatPositions, simulation);
  }

  // ══════════════════════════════════════════════════════════
  // ★ Teams Flow: Full Meeting → Relay Handoffs → Mid-Checkin → Wrap-up
  // ══════════════════════════════════════════════════════════

  private async runTeamsFlow(
    command: ParsedCommand,
    simulation: SimulationEngine,
    picked: typeof AGENT_ROSTER,
    morgan: typeof AGENT_ROSTER[0],
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
  ): Promise<void> {
    const morganId = 'roster-morgan';
    const allAgents = [morgan, ...picked];
    const allIds = allAgents.map(a => `roster-${a.id}`);
    const meetingPos = this.getMeetingPosition(allAgents.length);

    // ── Phase 1: Full Meeting (formal gather + extended discussion) ──
    simulation.log('info', 'Teams', 'Formal team meeting starting...');
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'gather', agentIds: allIds, zone: 'spawn' as ZoneName, taskSummary: command.description },
    });

    await this.gatherAgentsToMeeting(allAgents, meetingPos, seatPositions, simulation);

    // Extended discussion
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'discuss', agentIds: allIds, zone: 'spawn' as ZoneName },
    });
    this.setAgentsState(allAgents, 'discussing', simulation);

    const openText = `Alright team — ${picked.map(p => p.name).join(', ')} — let's plan this carefully.`;
    this.agentChat(morganId, openText, 3000, simulation, 'Morgan');
    await this.delay(1000);

    // Each agent discusses (more thorough than subagent)
    const shuffledDiscuss = [...DISCUSSION_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(picked.length, 4); i++) {
      await this.delay(900);
      const p = picked[i];
      const awareness = this.awarenessManager.getAwareness(p.id);
      const line = awareness.isEmpty
        ? FROM_SCRATCH_DISCUSSION_POOL[Math.floor(Math.random() * FROM_SCRATCH_DISCUSSION_POOL.length)]
        : shuffledDiscuss[i];
      this.agentChat(`roster-${p.id}`, line, 2000, simulation, p.name);
    }
    await this.delay(TIMING.MEETING_DISCUSS);

    // ── Phase 2: Relay Handoffs — agents visit each other's desks ──
    simulation.log('info', 'Teams', 'Agents dispersing for relay collaboration...');
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'disperse', agentIds: allIds, zone: 'spawn' as ZoneName },
    });

    // Everyone goes to their desk first
    await this.scatterAgentsToSeats(allAgents, meetingPos, seatPositions, simulation);

    // Relay: first agent walks to second agent's desk, hands off, etc.
    // Track current positions for accurate distance calculation
    const currentPos = new Map<string, { x: number; y: number }>();
    for (const p of picked) {
      const seat = seatPositions.get(`roster-${p.id}`)!;
      currentPos.set(`roster-${p.id}`, { x: seat.x, y: seat.y });
    }

    if (picked.length >= 2) {
      for (let i = 0; i < picked.length - 1; i++) {
        const from = picked[i];
        const to = picked[i + 1];
        const fromId = `roster-${from.id}`;
        const toSeat = seatPositions.get(`roster-${to.id}`)!;
        const fromPos = currentPos.get(fromId)!;

        // Walk from → to's desk
        this.moveAgent(fromId, toSeat.x + 30, toSeat.y, toSeat.zone, simulation);
        const relayWalk = this.calcWalkDelay(fromPos.x, fromPos.y, toSeat.x + 30, toSeat.y);
        await this.delay(relayWalk);

        // Handoff chat
        const handoffLine = HANDOFF_POOL[Math.floor(Math.random() * HANDOFF_POOL.length)];
        this.emitNow(simulation, { type: 'agent:state', payload: { agentId: fromId, state: 'communicating' } });
        this.agentChat(fromId, handoffLine, 2000, simulation);
        simulation.log('info', from.name, `→ ${to.name}: ${handoffLine}`);
        await this.delay(1200);

        // Walk back to own seat
        const fromHome = seatPositions.get(fromId)!;
        this.moveAgent(fromId, fromHome.x, fromHome.y, fromHome.zone, simulation);
        const returnWalk = this.calcWalkDelay(toSeat.x + 30, toSeat.y, fromHome.x, fromHome.y);
        await this.delay(returnWalk);
        this.emitNow(simulation, { type: 'agent:state', payload: { agentId: fromId, state: 'idle' } });
      }
    }

    // Set all to working
    this.setAgentsState(picked, 'thinking', simulation, 'Collaborating...');

    // ── Phase 3: Morgan orchestrates via SDK ──
    const taskId = `task-teams-${Date.now()}`;
    this.emitTaskEvent(simulation, taskId, command.description, 'pending', morganId, morgan, 'teams');
    this.emitTaskEvent(simulation, taskId, command.description, 'in_progress', morganId, morgan, 'teams');

    const awarenessContext = await this.awarenessManager.buildSystemPromptContext(morgan.id, this.config.workingDirectory);
    const fromScratch = this.awarenessManager.getAwareness(morgan.id).isEmpty;

    const descWithContext = this.buildWorkDescription(morganId, command.description);
    const session = this.createAgentSession(morganId, morgan, descWithContext, 'teams', awarenessContext, fromScratch, { maxTurns: 100, enableRosterAgents: true });

    const pickedIdsTeams = picked.map(p => `roster-${p.id}`);
    await this.runAgentSession(session, morganId, simulation, pickedIdsTeams);
    this.mergeSpawnedAgents(session, picked, seatPositions, simulation);
    this.cleanupSpawnedAgents(session, simulation);

    // ── Phase 4: Final Wrap-up Meeting ──
    // Rebuild participant list (picked may have grown from SDK-spawned agents)
    const wrapAgents = [morgan, ...picked];
    const wrapIds = wrapAgents.map(a => `roster-${a.id}`);

    simulation.log('info', 'Teams', 'Final wrap-up meeting...');
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'gather', agentIds: wrapIds, zone: 'spawn' as ZoneName },
    });

    await this.gatherAgentsToMeeting(wrapAgents, meetingPos, seatPositions, simulation);

    // Wrap-up discussion
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'discuss', agentIds: wrapIds, zone: 'spawn' as ZoneName },
    });
    this.setAgentsState(wrapAgents, 'discussing', simulation);

    const wrapText = 'Great work everyone! Let me summarize what we accomplished.';
    this.agentChat(morganId, wrapText, 3000, simulation, 'Morgan');
    await this.delay(2000);

    // Final disperse
    this.emitNow(simulation, {
      type: 'meeting:phase',
      payload: { phase: 'disperse', agentIds: wrapIds, zone: 'spawn' as ZoneName },
    });

    const doneText = 'Teams mode complete! All tasks finished.';
    this.emitTaskEvent(simulation, taskId, command.description, 'completed', morganId, morgan, 'teams');
    this.agentChat(morganId, doneText, 3000, simulation, morgan.name);
    await this.delay(1000);

    // Everyone returns to seats
    await this.scatterAgentsToSeats(wrapAgents, meetingPos, seatPositions, simulation);
    this.setAgentsState(wrapAgents, 'idle', simulation);
  }

  // ══════════════════════════════════════════════════════════
  // Codebase Scan
  // ══════════════════════════════════════════════════════════

  async runCodebaseScan(simulation: SimulationEngine): Promise<void> {
    const dir = this.config.workingDirectory;
    simulation.log('info', 'Morgan', 'Starting codebase scan...');

    this.emitNow(simulation, {
      type: 'agent:state',
      payload: { agentId: 'roster-morgan', state: 'thinking', detail: 'Analyzing project structure...' },
    });

    const scanResults = await Promise.all(
      AGENT_ROSTER.map(async (ra) => {
        const result = await this.awarenessManager.refreshAwareness(ra.id, dir);
        return { ra, result };
      })
    );

    for (const { ra, result } of scanResults) {
      const agentId = `roster-${ra.id}`;
      if (!result.isEmpty) {
        this.emitNow(simulation, {
          type: 'agent:state',
          payload: { agentId, state: 'thinking', detail: `${ra.role}: ${result.files.length} files` },
        });
        simulation.log('info', ra.name, `${result.files.length} files recognized`);
        await this.delay(250);
        this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state: 'idle' } });
      }
    }

    this.emitNow(simulation, { type: 'agent:state', payload: { agentId: 'roster-morgan', state: 'idle' } });

    const active = scanResults.filter(r => !r.result.isEmpty);
    const totalFiles = scanResults.reduce((sum, { result }) => sum + result.files.length, 0);
    simulation.log('info', 'Morgan', `Scan complete — ${active.length} agents recognized ${totalFiles} files total.`);
  }

  // ══════════════════════════════════════════════════════════
  // Shared Helpers
  // ══════════════════════════════════════════════════════════

  /** Run a single AgentSession and emit all events.
   *  `relatedAgentIds` — additional agents to reset to idle on error (e.g. picked agents in thinking state). */
  private async runAgentSession(
    session: AgentSession,
    agentId: string,
    simulation: SimulationEngine,
    relatedAgentIds: string[] = [],
  ): Promise<void> {
    // Resume existing SDK session if available for this agent
    const resumeId = this.agentSessionIds.get(agentId);
    this.activeSessions.set(agentId, session);
    try {
      for await (const event of session.run(resumeId)) {
        this.emitNow(simulation, event);
        await this.delay(250);
      }
      // Capture session ID for future resume
      const newSessionId = session.getSessionId();
      if (newSessionId) {
        this.agentSessionIds.set(agentId, newSessionId);
      }
      // Record work result in Brain's conversation history for chat continuity
      const resultText = session.getLastAssistantText();
      if (resultText) {
        const rosterId = agentId.replace('roster-', '');
        const roster = AGENT_ROSTER.find(a => a.id === rosterId);
        if (roster) {
          this.brain.addAgentMessage(rosterId, roster.name, resultText.slice(0, 500));
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      simulation.log('error', 'RealExecutionEngine', `Session error [${agentId}]: ${errMsg}`);
      this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state: 'failed', detail: errMsg } });
      // On error, clear the session ID so next attempt starts fresh
      this.agentSessionIds.delete(agentId);
      for (const rid of relatedAgentIds) {
        this.emitNow(simulation, { type: 'agent:state', payload: { agentId: rid, state: 'idle' } });
      }
    } finally {
      this.activeSessions.delete(agentId);
    }
  }

  /** Clean up spawned subagents after a session.
   *  Roster agents: just despawn non-roster. Roster agents are handled by the flow's report/wrap-up phase. */
  private cleanupSpawnedAgents(
    session: AgentSession,
    simulation: SimulationEngine,
  ): void {
    for (const subId of session.getSpawnedAgentIds()) {
      if (!subId.startsWith('roster-')) {
        this.emitNow(simulation, { type: 'agent:despawn', payload: { agentId: subId, reason: 'completed' } });
      }
      // Roster agents are NOT set to idle here — the flow's report/wrap-up phase handles them
    }
  }

  /** Return agent to seat and wait for the tween to finish, then set idle */
  private async returnToSeatAndWait(
    agentId: string,
    fromX: number, fromY: number,
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
    simulation: SimulationEngine,
  ): Promise<void> {
    const seat = seatPositions.get(agentId);
    if (seat) {
      this.moveAgent(agentId, seat.x, seat.y, seat.zone, simulation);
      await this.delay(this.calcWalkDelay(fromX, fromY, seat.x, seat.y));
    }
    this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state: 'idle' } });
  }

  /** Merge roster agents that were spawned by the SDK but weren't in the original `picked` list */
  private mergeSpawnedAgents(
    session: AgentSession,
    picked: typeof AGENT_ROSTER,
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
    simulation: SimulationEngine,
  ): void {
    const spawnedRosterIds = session.getSpawnedAgentIds()
      .filter(id => id.startsWith('roster-'))
      .map(id => id.replace('roster-', ''));
    for (const sid of spawnedRosterIds) {
      if (sid !== 'morgan' && !picked.some(p => p.id === sid)) {
        const extra = AGENT_ROSTER.find(a => a.id === sid);
        if (extra) {
          picked.push(extra);
          if (!seatPositions.has(`roster-${sid}`)) {
            const aid = `roster-${sid}`;
            const agentData = simulation.world.rosterAgents.get(aid);
            const fallback = getZoneCenter(extra.homeZone);
            seatPositions.set(aid, {
              x: agentData?.x ?? fallback.x,
              y: agentData?.y ?? fallback.y,
              zone: extra.homeZone as ZoneName,
            });
          }
        }
      }
    }
  }

  /** Capture seat positions for a set of agents */
  private captureSeatPositions(
    agents: typeof AGENT_ROSTER,
    simulation: SimulationEngine,
  ): Map<string, { x: number; y: number; zone: ZoneName }> {
    const positions = new Map<string, { x: number; y: number; zone: ZoneName }>();
    for (const p of agents) {
      const aid = `roster-${p.id}`;
      const agentData = simulation.world.rosterAgents.get(aid);
      const fallback = getZoneCenter(p.homeZone);
      positions.set(aid, {
        x: agentData?.x ?? fallback.x,
        y: agentData?.y ?? fallback.y,
        zone: p.homeZone as ZoneName,
      });
    }
    return positions;
  }

  /** Emit a task:event for the TaskBoard */
  private emitTaskEvent(
    simulation: SimulationEngine,
    taskId: string,
    description: string,
    status: 'pending' | 'in_progress' | 'completed',
    agentId: string,
    roster: typeof AGENT_ROSTER[0],
    teamId = 'single',
  ): void {
    const action = status === 'pending' ? 'create' : status === 'completed' ? 'complete' : 'update';
    this.emitNow(simulation, {
      type: 'task:event',
      payload: {
        action,
        task: {
          id: taskId, subject: description, description,
          status, ownerId: agentId, ownerName: roster.name,
          ownerColor: roster.color, blockedBy: [], teamId,
        },
      },
    });
  }

  /** Stop active sessions but preserve conversation state (history, lastChatAgentId) */
  stopSessions(): void {
    this.cancelled = true;
    for (const session of this.activeSessions.values()) {
      session.stop();
    }
    this.activeSessions.clear();
  }

  /** Stop all active sessions and clear conversation state (hard reset) */
  stopAll(): void {
    this.stopSessions();
    this.agentSessionIds.clear();
    this.brain.clearHistory();
    this.lastChatAgentId = null;
  }

  private getMeetingPosition(participantCount: number): { x: number; y: number } {
    return participantCount >= 3
      ? { x: 747, y: 280 }   // Conference table
      : { x: 1155, y: 260 }; // Sofa area
  }

  private dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  private calcWalkDelay(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.max(800, this.dist(fromX, fromY, toX, toY) * 2 + 200);
  }

  private emitNow(simulation: SimulationEngine, event: ServerMessage): void {
    simulation.applyEvent(event);
    simulation.emit('event', event);
  }

  /** Emit move + state:moving in one call */
  private moveAgent(agentId: string, targetX: number, targetY: number, targetZone: ZoneName, simulation: SimulationEngine, state: 'moving' | 'gathering' = 'moving'): void {
    this.emitNow(simulation, { type: 'agent:state', payload: { agentId, state } });
    this.emitNow(simulation, { type: 'agent:move', payload: { agentId, targetX, targetY, targetZone, path: [] } });
  }

  /** Emit agent:chat + log in one call */
  private agentChat(agentId: string, text: string, duration: number, simulation: SimulationEngine, logName?: string): void {
    this.emitNow(simulation, { type: 'agent:chat', payload: { agentId, text, duration } });
    if (logName) simulation.log('info', logName, text);
  }

  private delay(ms: number): Promise<void> {
    if (this.cancelled) return Promise.reject(new Error('Cancelled'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      // Check cancellation periodically for long delays
      const check = setInterval(() => {
        if (this.cancelled) {
          clearTimeout(timer);
          clearInterval(check);
          reject(new Error('Cancelled'));
        }
      }, 200);
      // Clean up check interval when timer completes normally
      setTimeout(() => clearInterval(check), ms + 10);
    });
  }

  /** Gather agents to meeting position with spread — used 3x across subagent/teams flows */
  private async gatherAgentsToMeeting(
    agents: typeof AGENT_ROSTER,
    meetingPos: { x: number; y: number },
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
    simulation: SimulationEngine,
  ): Promise<void> {
    let maxDist = 0;
    agents.forEach((p, i) => {
      const aid = `roster-${p.id}`;
      const spread = (i - agents.length / 2) * 40;
      const tx = meetingPos.x + spread;
      const ty = meetingPos.y;
      const seat = seatPositions.get(aid);
      if (seat) maxDist = Math.max(maxDist, this.dist(seat.x, seat.y, tx, ty));
      this.moveAgent(aid, tx, ty, 'spawn' as ZoneName, simulation, 'gathering');
    });
    await this.delay(Math.max(TIMING.MEETING_GATHER, maxDist * 2 + 200));
  }

  /** Scatter agents back to their seats — used 3x across subagent/teams flows */
  private async scatterAgentsToSeats(
    agents: typeof AGENT_ROSTER,
    fromPos: { x: number; y: number },
    seatPositions: Map<string, { x: number; y: number; zone: ZoneName }>,
    simulation: SimulationEngine,
  ): Promise<void> {
    let maxDist = 0;
    for (const p of agents) {
      const aid = `roster-${p.id}`;
      const seat = seatPositions.get(aid)!;
      maxDist = Math.max(maxDist, this.dist(fromPos.x, fromPos.y, seat.x, seat.y));
      this.moveAgent(aid, seat.x, seat.y, seat.zone, simulation);
    }
    await this.delay(Math.max(600, maxDist * 2 + 200));
  }

  /** Create an AgentSession with roster config — used 3x across single/subagent/teams */
  private createAgentSession(
    agentId: string,
    roster: typeof AGENT_ROSTER[0],
    description: string,
    mode: 'single' | 'subagent' | 'teams',
    awarenessContext: string,
    fromScratch: boolean,
    extra?: { maxTurns?: number; enableRosterAgents?: boolean },
  ): AgentSession {
    return new AgentSession({
      agentId, agentName: roster.name, agentRole: roster.role,
      description, workingDirectory: this.config.workingDirectory,
      model: this.config.model, mode,
      permissionMode: this.config.permissionMode, onPermissionRequest: this.config.onPermissionRequest,
      rosterName: roster.name, rosterRole: roster.role,
      rosterSkills: roster.skills, rosterSystemPrompt: roster.systemPrompt,
      awarenessContext, fromScratch,
      ...extra,
    });
  }

  /** Build work description with chat history context (for chat→work transition).
   *  If the agent already has a resumed SDK session, skip history injection (SDK has it). */
  private buildWorkDescription(agentId: string, description: string): string {
    if (this.agentSessionIds.has(agentId)) return description;
    const history = this.brain.buildHistoryContext();
    if (!history) return description;
    return `${history}\n\nCurrent request: ${description}`;
  }

  /** Set all agents in list to a specific state */
  private setAgentsState(
    agents: typeof AGENT_ROSTER,
    state: AgentState,
    simulation: SimulationEngine,
    detail?: string,
  ): void {
    for (const p of agents) {
      this.emitNow(simulation, {
        type: 'agent:state',
        payload: { agentId: `roster-${p.id}`, state, ...(detail ? { detail } : {}) },
      });
    }
  }
}
