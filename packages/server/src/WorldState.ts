import { v4 as uuid } from 'uuid';
import type { AgentData, AgentType, ChatMessageData, SimMode, TaskData, ZoneName } from '@theater/shared';
import { AGENT_COLORS, AGENT_NAMES, AGENT_ROSTER, ZONES, TILE_SIZE, toRosterId, getRosterAgentByRosterId } from '@theater/shared';
import type { RosterAgent } from '@theater/shared';

export class WorldState {
  agents: Map<string, AgentData> = new Map();
  rosterAgents: Map<string, AgentData> = new Map(); // persistent roster agents
  /** Actual pixel home positions loaded from bg-seats.json — overrides tile-based defaults */
  private homeSeatPositions: Map<string, { x: number; y: number }> = new Map();
  tasks: Map<string, TaskData> = new Map();
  messages: ChatMessageData[] = [];
  mode: SimMode | null = null;
  speed = 1.0;
  tick = 0;

  createAgent(type: AgentType, options?: {
    role?: string;
    parentId?: string;
    teamId?: string;
    x?: number;
    y?: number;
  }): AgentData {
    const spawnZone = ZONES.find(z => z.name === 'spawn')!;
    const id = uuid().slice(0, 8);

    const agent: AgentData = {
      id,
      type,
      state: 'spawning',
      displayName: `${AGENT_NAMES[type]}-${id.slice(0, 4)}`,
      role: options?.role || AGENT_NAMES[type],
      color: AGENT_COLORS[type],
      x: options?.x ?? (spawnZone.x + Math.floor(spawnZone.width / 2)) * TILE_SIZE,
      y: options?.y ?? (spawnZone.y + Math.floor(spawnZone.height / 2)) * TILE_SIZE,
      direction: 'down',
      parentId: options?.parentId,
      teamId: options?.teamId,
      currentZone: 'spawn',
    };

    this.agents.set(id, agent);
    return agent;
  }

  updateAgent(id: string, updates: Partial<AgentData>): AgentData | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    Object.assign(agent, updates);
    return agent;
  }

  createTask(subject: string, description: string, teamId: string): TaskData {
    const id = uuid().slice(0, 8);
    const task: TaskData = {
      id,
      subject,
      description,
      status: 'pending',
      blockedBy: [],
      teamId,
    };
    this.tasks.set(id, task);
    return task;
  }

  updateTask(id: string, updates: Partial<TaskData>): TaskData | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, updates);
    return task;
  }

  addMessage(fromId: string, toId: string | 'broadcast', content: string, summary: string): ChatMessageData {
    const msg: ChatMessageData = {
      id: uuid().slice(0, 8),
      fromId,
      toId,
      content,
      summary,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    if (this.messages.length > 200) {
      this.messages = this.messages.slice(-100);
    }
    return msg;
  }

  static readonly TEAM_LEAD_ID = toRosterId('morgan');

  /** Initialize persistent roster agents at their home zones */
  ensureRoster(): void {
    for (const ra of AGENT_ROSTER) {
      const rosterId = toRosterId(ra.id);
      if (this.rosterAgents.has(rosterId)) continue;

      // Use predefined seat positions (tile coords → pixel coords)
      const x = ra.seatX * TILE_SIZE + TILE_SIZE / 2;
      const y = ra.seatY * TILE_SIZE + TILE_SIZE / 2;

      const agent: AgentData = {
        id: rosterId,
        type: ra.agentType,
        state: 'idle',
        displayName: ra.name,
        role: ra.role,
        color: ra.color,
        x,
        y,
        direction: 'down',
        currentZone: ra.homeZone,
      };

      this.rosterAgents.set(rosterId, agent);
      this.agents.set(rosterId, agent);
    }
  }

  /** Store actual pixel home position from bg-seats.json */
  setHomeSeat(agentId: string, x: number, y: number): void {
    this.homeSeatPositions.set(agentId, { x, y });
  }

  /** Return a roster agent to its home zone in idle state */
  returnRosterAgentHome(rosterId: string): void {
    const agent = this.rosterAgents.get(rosterId);
    if (!agent) return;
    const ra = getRosterAgentByRosterId(rosterId);
    if (!ra) return;

    // Prefer bg-seats.json pixel position; fall back to tile-based if not loaded yet
    const homePos = this.homeSeatPositions.get(rosterId);
    agent.x = homePos ? homePos.x : ra.seatX * TILE_SIZE + TILE_SIZE / 2;
    agent.y = homePos ? homePos.y : ra.seatY * TILE_SIZE + TILE_SIZE / 2;
    agent.state = 'idle';
    agent.currentZone = ra.homeZone;
  }

  reset(): void {
    this.agents.clear();
    this.tasks.clear();
    this.messages = [];
    this.mode = null;
    this.tick = 0;
    // Restore roster agents (idle at home zones)
    for (const [id, agent] of this.rosterAgents) {
      this.returnRosterAgentHome(id);
      this.agents.set(id, agent);
    }
  }

  removeAgent(id: string): boolean {
    // Roster agents should not be removed — return them home instead
    if (this.rosterAgents.has(id)) {
      this.returnRosterAgentHome(id);
      return false;
    }
    return this.agents.delete(id);
  }

  toSnapshot() {
    return {
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      messages: this.messages.slice(-50), // last 50 messages
      mode: this.mode,
      speed: this.speed,
      tick: this.tick,
    };
  }
}
