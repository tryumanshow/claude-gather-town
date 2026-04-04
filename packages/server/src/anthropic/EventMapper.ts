import type { ServerMessage, ToolType, ZoneName } from '@theater/shared';
import { TIMING } from '@theater/shared';
import type { RosterAgent } from '@theater/shared';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SDKToolUseBlock } from './sdkTypes.js';
import { SubAgentTracker } from './SubAgentTracker.js';

/** Maps Claude Code tool names to Theater ToolType */
const TOOL_NAME_MAP: Record<string, ToolType> = {
  Read: 'Read', Edit: 'Edit', Write: 'Write', Bash: 'Bash',
  Grep: 'Grep', Glob: 'Glob', WebSearch: 'WebSearch', WebFetch: 'WebFetch',
  Task: 'Task', Agent: 'Task', SendMessage: 'SendMessage',
  TaskCreate: 'TaskCreate', TaskUpdate: 'TaskUpdate', TeamCreate: 'TeamCreate',
};

export class EventMapper {
  private mainAgentId: string;
  private tracker: SubAgentTracker;

  constructor(
    mainAgentId: string,
    availableAgents: Array<{ name: string; color: string }>,
    availableRoster: RosterAgent[] = [],
  ) {
    this.mainAgentId = mainAgentId;
    this.tracker = new SubAgentTracker(mainAgentId, availableAgents, availableRoster);
  }

  /** Map an SDKMessage to zero or more Theater ServerMessages */
  mapMessage(message: SDKMessage): ServerMessage[] {
    switch (message.type) {
      case 'system':
        return this.mapSystemMessage(message);
      case 'assistant':
        return this.mapAssistantMessage(message);
      case 'user':
        return this.mapUserMessage(message);
      case 'tool_progress':
        return this.mapToolProgress(message);
      case 'result':
        return this.mapResult(message);
      default:
        return [];
    }
  }

  /** System messages include task_started/task_progress/task_notification subtypes */
  private mapSystemMessage(message: SDKMessage & { type: 'system' }): ServerMessage[] {
    const subtype = 'subtype' in message ? (message as { subtype?: string }).subtype : undefined;
    const toolUseId = 'tool_use_id' in message ? (message as { tool_use_id?: string }).tool_use_id : undefined;

    if (subtype === 'task_started') {
      return toolUseId ? this.tracker.spawnSubAgent(toolUseId) : [];
    }

    if (subtype === 'task_progress') {
      const agentId = this.tracker.resolveAgentId(toolUseId);
      const desc = 'description' in message ? String((message as { description?: string }).description || '').slice(0, 80) : '';
      return desc ? [{ type: 'agent:chat', payload: { agentId, text: `📊 ${desc}`, duration: 2000 } }] : [];
    }

    if (subtype === 'task_notification') {
      return toolUseId ? this.tracker.handleTaskNotification(toolUseId) : [];
    }

    return [];
  }

  private mapAssistantMessage(message: SDKMessage & { type: 'assistant' }): ServerMessage[] {
    const events: ServerMessage[] = [];
    const agentId = this.tracker.resolveAgentId(message.parent_tool_use_id);
    const content = message.message?.content;
    if (!Array.isArray(content)) return events;

    for (const block of content) {
      if (block.type === 'text' && 'text' in block) {
        const text = (block as { type: 'text'; text: string }).text.trim();
        if (text) {
          events.push({
            type: 'agent:chat',
            payload: { agentId, text: text.length > 150 ? text.slice(0, 150) + '...' : text, duration: 3500 },
          });
          events.push({
            type: 'agent:text',
            payload: { agentId, text, role: 'assistant' as const },
          });
        }
      } else if (block.type === 'tool_use') {
        events.push(...this.mapToolUse(agentId, block as SDKToolUseBlock));
      }
    }
    return events;
  }

  private mapUserMessage(message: SDKMessage & { type: 'user' }): ServerMessage[] {
    const events: ServerMessage[] = [];
    const userContent = message.message?.content;
    if (!Array.isArray(userContent)) return events;

    for (const block of userContent) {
      if (block.type === 'tool_result' && 'content' in block && block.content) {
        const rawContent = block.content;
        const resultText = typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map((c: { type: string; text?: string }) => c.text || '').join('\n')
            : String(rawContent);
        const trimmed = resultText.trim();
        if (trimmed) {
          events.push({
            type: 'agent:text',
            payload: {
              agentId: this.tracker.resolveAgentId(message.parent_tool_use_id),
              text: trimmed.length > 2000 ? trimmed.slice(0, 2000) + '...' : trimmed,
              role: 'tool_result' as const,
            },
          });
        }
      }
    }
    return events;
  }

  private mapToolProgress(message: SDKMessage & { type: 'tool_progress' }): ServerMessage[] {
    if (!message.tool_name) return [];
    return [{
      type: 'agent:chat',
      payload: { agentId: this.mainAgentId, text: `🔧 ${message.tool_name}`, duration: 2000 },
    }];
  }

  private mapResult(message: SDKMessage & { type: 'result' }): ServerMessage[] {
    const events: ServerMessage[] = [];

    if (message.subtype === 'success') {
      const costInfo = message.total_cost_usd ? ` ($${message.total_cost_usd.toFixed(4)})` : '';
      events.push({
        type: 'agent:state',
        payload: { agentId: this.mainAgentId, state: 'completed', detail: `Done — ${message.num_turns} turns${costInfo}` },
      });
      if (message.result) {
        const resultText = message.result.trim();
        if (resultText) {
          events.push({
            type: 'agent:chat',
            payload: { agentId: this.mainAgentId, text: resultText.length > 200 ? resultText.slice(0, 200) + '...' : resultText, duration: 5000 },
          });
          events.push({
            type: 'agent:text',
            payload: { agentId: this.mainAgentId, text: resultText, role: 'assistant' as const },
          });
        }
      }
    } else {
      events.push(...this.mapError(
        `Execution ended: ${message.subtype}${message.errors ? ' - ' + message.errors.join(', ') : ''}`,
      ));
    }
    return events;
  }

  /** Map a tool_use content block to Theater events */
  private mapToolUse(agentId: string, block: SDKToolUseBlock): ServerMessage[] {
    const events: ServerMessage[] = [];
    const toolName = block.name;
    const theaterTool = TOOL_NAME_MAP[toolName] || 'Read';

    // Special handling for Agent/Task tool — subagent will be spawned via task_started event
    if (toolName === 'Agent' || toolName === 'Task') {
      const taskInput = block.input || {};
      const targetRosterId = taskInput.subagent_type as string | undefined;
      if (targetRosterId) {
        this.tracker.registerTargetRoster(block.id, targetRosterId);
      }
      events.push({
        type: 'agent:chat',
        payload: { agentId, text: `🚀 서브에이전트 스폰: ${targetRosterId || taskInput.description || 'task'}`, duration: 2500 },
      });
      this.tracker.registerParent(block.id, agentId);
      return events;
    }

    // Build description from tool input
    const input = block.input || {};
    let desc = toolName;
    if (input.file_path) desc = `${toolName}: ${input.file_path}`;
    else if (input.command) desc = `${toolName}: ${String(input.command).slice(0, 50)}`;
    else if (input.pattern) desc = `${toolName}: ${input.pattern}`;
    else if (input.query) desc = `${toolName}: ${String(input.query).slice(0, 50)}`;

    const filePath = input.file_path ? String(input.file_path) : undefined;
    events.push({
      type: 'agent:tool',
      payload: { agentId, tool: theaterTool, description: desc, duration: TIMING.TOOL_USE, filePath },
    });
    events.push({
      type: 'agent:text',
      payload: { agentId, text: `> Tool: ${toolName}\n${JSON.stringify(input).slice(0, 500)}`, role: 'tool_result' as const },
    });
    events.push({
      type: 'agent:state',
      payload: { agentId, state: 'acting', detail: desc },
    });
    return events;
  }

  /** Generate error events */
  mapError(error: string): ServerMessage[] {
    return [
      { type: 'agent:chat', payload: { agentId: this.mainAgentId, text: `❌ ${error.slice(0, 120)}`, duration: 4000 } },
      { type: 'agent:state', payload: { agentId: this.mainAgentId, state: 'failed', detail: error } },
    ];
  }

  /** Get all ever-spawned subagent IDs (cumulative) */
  getSpawnedAgentIds(): string[] {
    return this.tracker.getSpawnedAgentIds();
  }
}
