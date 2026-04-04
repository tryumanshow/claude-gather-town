/**
 * Tracks subagent spawning, lifecycle, and parent-child routing.
 * Extracted from EventMapper to separate message mapping from agent management.
 */
import type { ServerMessage, ZoneName, AgentType } from '@theater/shared';
import { getZoneCenter, toRosterId } from '@theater/shared';
import type { RosterAgent } from '@theater/shared';

interface SubAgentInfo {
  agentId: string;
  name: string;
  color: string;
  toolUseId: string;
  rosterId?: string;
  homeZone?: ZoneName;
}

export class SubAgentTracker {
  private availableAgents: Array<{ name: string; color: string }>;
  private availableRoster: RosterAgent[];
  private rosterIndex = 0;
  private agentIndex = 0;

  // Maps tool_use_id → SubAgentInfo (active subagents only)
  private subAgents: Map<string, SubAgentInfo> = new Map();
  // Cumulative set of ALL ever-spawned agent IDs (not cleared on task_notification)
  private allSpawnedAgentIds: Set<string> = new Set();
  // Maps parent_tool_use_id → agentId for routing subagent messages
  private parentToAgent: Map<string, string> = new Map();
  // Maps tool_use_id → target roster ID (from Agent tool input.subagent_type)
  private targetRosterMap: Map<string, string> = new Map();

  constructor(
    private mainAgentId: string,
    availableAgents: Array<{ name: string; color: string }>,
    availableRoster: RosterAgent[] = [],
  ) {
    this.availableAgents = availableAgents;
    this.availableRoster = availableRoster;
  }

  /** Resolve which Theater agentId a message belongs to */
  resolveAgentId(parentToolUseId: string | null | undefined): string {
    if (!parentToolUseId) return this.mainAgentId;
    return this.parentToAgent.get(parentToolUseId) || this.mainAgentId;
  }

  /** Register a parent tool_use_id → agent mapping (for Task/Agent tool calls) */
  registerParent(toolUseId: string, agentId: string): void {
    this.parentToAgent.set(toolUseId, agentId);
  }

  /** Store which roster agent the SDK Agent tool targets (from input.subagent_type) */
  registerTargetRoster(toolUseId: string, rosterId: string): void {
    this.targetRosterMap.set(toolUseId, rosterId);
  }

  /** Spawn a Theater agent for a subagent task — match target roster agent, then fallback */
  spawnSubAgent(toolUseId: string): ServerMessage[] {
    const events: ServerMessage[] = [];

    // Look up the specific roster agent targeted by the Agent tool call
    const rosterAgent = this.findTargetRoster(toolUseId) || this.pickNextRoster();
    if (rosterAgent) {
      const agentId = toRosterId(rosterAgent.id);
      const info: SubAgentInfo = {
        agentId, name: rosterAgent.name, color: rosterAgent.color,
        toolUseId, rosterId: rosterAgent.id, homeZone: rosterAgent.homeZone,
      };
      this.subAgents.set(toolUseId, info);
      this.allSpawnedAgentIds.add(agentId);
      this.parentToAgent.set(toolUseId, agentId);

      events.push({
        type: 'agent:state',
        payload: { agentId, state: 'thinking', detail: 'Assigned subtask' },
      });
      events.push({
        type: 'agent:chat',
        payload: { agentId, text: `네, ${rosterAgent.name}이 맡겠습니다! 💪`, duration: 2000 },
      });
      return events;
    }

    // Fallback to generic agent
    const agent = this.pickNextAgent();
    if (!agent) return events;

    const agentId = `sub-${agent.name}`;
    const spawnPos = getZoneCenter('spawn');
    const offsetX = (this.agentIndex - 1) * 40 - 40;

    const info: SubAgentInfo = { agentId, name: agent.name, color: agent.color, toolUseId };
    this.subAgents.set(toolUseId, info);
    this.allSpawnedAgentIds.add(agentId);
    this.parentToAgent.set(toolUseId, agentId);

    events.push({
      type: 'agent:spawn',
      payload: {
        agentId, agentType: 'executor' as AgentType, role: 'Agent',
        displayName: agent.name, color: agent.color,
        x: spawnPos.x + offsetX, y: spawnPos.y,
      },
    });
    events.push({
      type: 'agent:chat',
      payload: { agentId, text: '네, 맡겨주세요! 시작합니다 💪', duration: 2000 },
    });
    return events;
  }

  /** Handle task_notification — complete or despawn the subagent */
  handleTaskNotification(toolUseId: string): ServerMessage[] {
    const events: ServerMessage[] = [];
    const info = this.subAgents.get(toolUseId);
    if (!info) return events;

    events.push({
      type: 'agent:state',
      payload: { agentId: info.agentId, state: 'completed' },
    });

    if (info.rosterId && info.homeZone) {
      events.push({
        type: 'agent:state',
        payload: { agentId: info.agentId, state: 'idle' },
      });
    } else {
      const spawnPos = getZoneCenter('spawn');
      events.push({
        type: 'agent:move',
        payload: {
          agentId: info.agentId,
          targetX: spawnPos.x, targetY: spawnPos.y,
          targetZone: 'spawn' as ZoneName, path: [],
        },
      });
      events.push({
        type: 'agent:despawn',
        payload: { agentId: info.agentId, reason: 'completed' },
      });
    }
    this.subAgents.delete(toolUseId);
    return events;
  }

  /** Get all ever-spawned subagent IDs (cumulative) */
  getSpawnedAgentIds(): string[] {
    return Array.from(this.allSpawnedAgentIds);
  }

  /** Find the specific roster agent targeted by this tool_use_id */
  private findTargetRoster(toolUseId: string): RosterAgent | null {
    const targetId = this.targetRosterMap.get(toolUseId);
    if (!targetId) return null;
    this.targetRosterMap.delete(toolUseId);
    const agent = this.availableRoster.find(a => a.id === targetId);
    return agent || null;
  }

  private pickNextRoster(): RosterAgent | null {
    if (this.rosterIndex >= this.availableRoster.length) return null;
    return this.availableRoster[this.rosterIndex++];
  }

  private pickNextAgent(): { name: string; color: string } | null {
    if (this.agentIndex >= this.availableAgents.length) return null;
    return this.availableAgents[this.agentIndex++];
  }
}
