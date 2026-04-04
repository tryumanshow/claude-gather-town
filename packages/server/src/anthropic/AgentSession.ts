import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { ServerMessage, AgentPermissionPayload } from '@theater/shared';
import { AGENT_ROSTER, fromRosterId, toErrorMessage } from '@theater/shared';
import { EventMapper } from './EventMapper.js';
import { loadSkill } from '../skills/loader.js';

export interface AgentSessionConfig {
  agentId: string;
  agentName: string;
  agentRole: string;
  description: string;
  workingDirectory: string;
  model?: string;
  mode: 'single' | 'subagent' | 'teams';
  availableAgents?: Array<{ name: string; color: string }>;
  permissionMode?: 'acceptEdits' | 'bypassPermissions';
  onPermissionRequest?: (req: AgentPermissionPayload) => Promise<boolean>;
  // Roster agent info
  rosterName?: string;
  rosterRole?: string;
  rosterSkills?: string[];
  rosterSystemPrompt?: string;
  // Codebase awareness context
  awarenessContext?: string;
  // True when this agent's role area has no existing code files
  fromScratch?: boolean;
  // Override the auto-generated prompt entirely
  promptOverride?: string;
  // Max turns for the agent session (default: 30)
  maxTurns?: number;
  // Enable roster sub-agents via SDK agents option
  enableRosterAgents?: boolean;
}

/** Read-only tools that are safe to auto-approve without user confirmation */
const SAFE_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch',
  'Agent', 'Task', 'ToolSearch',
  'ListMcpResourcesTool', 'ReadMcpResourceTool',
]);

function buildToolDescription(tool: string, input: Record<string, unknown>): string {
  if (input.command) return `${tool}: ${String(input.command).slice(0, 80)}`;
  if (input.file_path) return `${tool}: ${input.file_path}`;
  if (input.pattern) return `${tool}: ${input.pattern}`;
  return tool;
}

/** Build SDK AgentDefinition records from AGENT_ROSTER.
 *  Uses skill.md files as the prompt when available, falling back to inline systemPrompt.
 *  Results are cached per excludeId since AGENT_ROSTER is static. */
const _rosterDefCache = new Map<string | undefined, Record<string, AgentDefinition>>();
function buildRosterAgentDefinitions(excludeId?: string): Record<string, AgentDefinition> {
  const cached = _rosterDefCache.get(excludeId);
  if (cached) return cached;

  const agents: Record<string, AgentDefinition> = {};

  for (const ra of AGENT_ROSTER) {
    if (ra.id === excludeId) continue;

    const skillContent = loadSkill(ra.id);
    const prompt = skillContent || ra.systemPrompt;

    agents[ra.id] = {
      description: `${ra.name} — ${ra.role}. Expertise: ${ra.skills.slice(0, 6).join(', ')}. Use this agent for ${ra.role}-related tasks.`,
      prompt,
      model: 'sonnet',
      maxTurns: 30,
    };
  }

  _rosterDefCache.set(excludeId, agents);
  return agents;
}

export class AgentSession {
  private config: AgentSessionConfig;
  private eventMapper: EventMapper;
  private abortController = new AbortController();
  // Pre-computed roster list strings, reused in prompt building
  private rosterListSimple: string;
  private rosterListDetailed: string;
  // Session ID captured from SDK for resume support
  private sessionId: string | undefined;
  // Last assistant text from the session (for conversation history tracking)
  private lastAssistantText: string | undefined;

  constructor(config: AgentSessionConfig) {
    this.config = config;
    const mainRosterId = fromRosterId(config.agentId);
    const subRoster = AGENT_ROSTER.filter(ra => ra.id !== mainRosterId);
    this.eventMapper = new EventMapper(
      config.agentId,
      config.availableAgents || [],
      subRoster,
    );
    this.rosterListSimple = subRoster.map(a => `- ${a.id}: ${a.name} (${a.role})`).join('\n');
    this.rosterListDetailed = subRoster.map(a => `- ${a.id}: ${a.name} (${a.role}) — ${a.skills.slice(0, 4).join(', ')}`).join('\n');
  }

  private buildPrompt(): string {
    if (this.config.promptOverride) return this.config.promptOverride;
    const { description, mode } = this.config;

    switch (mode) {
      case 'single':
        return description;

      case 'subagent':
        return `Perform the following task by delegating subtasks to team members.

IMPORTANT: You MUST use the "Agent" tool (not SendMessage) to delegate work. Each Agent call spawns a real sub-agent that can use tools (Read, Edit, Bash, WebSearch, etc.) and return results.
- Do NOT use SendMessage — it does nothing.
- Call the Agent tool with the agent's id as subagent_type.

Available team member agents:
${this.rosterListSimple}

After all agents complete, synthesize their results into a final answer.

Task: ${description}`;

      case 'teams':
        return `Perform the following task in team mode by coordinating work across team members.

IMPORTANT: You MUST use the "Agent" tool (not SendMessage) to delegate work. Each Agent call spawns a real sub-agent that can use tools (Read, Edit, Bash, WebSearch, etc.) and return results.
- Do NOT use SendMessage — it does nothing.
- Call the Agent tool with the agent's id as subagent_type.

Available team member agents:
${this.rosterListDetailed}

1. Analyze the task and select the needed team members
2. Use the Agent tool to assign specific subtasks to each member
3. Wait for all results, then synthesize into a final report

Task: ${description}`;
    }
  }

  private buildSystemPromptAppend(): string {
    const { agentName, agentRole, rosterName, rosterRole, rosterSkills, rosterSystemPrompt, awarenessContext, fromScratch } = this.config;

    const awarenessSection = awarenessContext ? `\n\n${awarenessContext}` : '';
    const fromScratchSection = fromScratch
      ? `\n\nWARNING: No existing code in this role area. Implement from scratch: create necessary directories and files, starting from interface/type definitions through to full implementation.`
      : '';

    // If this is a roster agent, load skill.md first, fallback to inline systemPrompt
    if (rosterName) {
      const agentRosterId = fromRosterId(this.config.agentId);
      const skillContent = loadSkill(agentRosterId);
      const skillSection = skillContent || rosterSystemPrompt || '';
      const skillsStr = rosterSkills?.join(', ') || '';

      return `\n\nYou are ${rosterName}. Your role is ${rosterRole || agentRole}.
Expertise: ${skillsStr}

${skillSection}

For casual conversation, respond naturally. For technical work requests, use tools to handle them.${awarenessSection}${fromScratchSection}`;
    }

    return `\n\nYou are ${agentName}. Your role is ${agentRole}.
For casual conversation, respond naturally. For technical work requests, use tools to handle them. Always respond in Korean.${awarenessSection}${fromScratchSection}`;
  }

  /** Run the agent session, yielding Theater events.
   *  If resumeSessionId is provided, resumes an existing SDK session. */
  async *run(resumeSessionId?: string): AsyncGenerator<ServerMessage> {
    const prompt = this.buildPrompt();
    const useBypass = this.config.permissionMode === 'bypassPermissions';

    const canUseTool = this.config.onPermissionRequest
      ? async (toolName: string, input: Record<string, unknown>) => {
          // Auto-approve safe read-only tools
          if (SAFE_TOOLS.has(toolName)) {
            return { behavior: 'allow' as const, updatedInput: input };
          }
          const permissionId = Math.random().toString(36).slice(2, 10);
          const description = buildToolDescription(toolName, input);
          const approved = await this.config.onPermissionRequest!({
            permissionId,
            agentId: this.config.agentId,
            toolName,
            description,
            input,
          });
          return approved
            ? { behavior: 'allow' as const, updatedInput: input }
            : { behavior: 'deny' as const, message: 'User denied the request.' };
        }
      : undefined;

    // Build agents option: register roster agents as custom sub-agents
    const mainRosterId = fromRosterId(this.config.agentId);
    const agents = this.config.enableRosterAgents
      ? buildRosterAgentDefinitions(mainRosterId)
      : undefined;

    const baseOptions = {
      cwd: this.config.workingDirectory,
      model: this.config.model,
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: this.buildSystemPromptAppend(),
      },
      tools: { type: 'preset' as const, preset: 'claude_code' as const },
      agents,
      permissionMode: useBypass ? 'bypassPermissions' as const : 'acceptEdits' as const,
      allowDangerouslySkipPermissions: useBypass,
      canUseTool,
      abortController: this.abortController,
      includePartialMessages: false,
      maxTurns: this.config.maxTurns ?? 30,
    };

    // Resume existing session or start new one
    const q = query({
      prompt,
      options: resumeSessionId
        ? { ...baseOptions, resume: resumeSessionId }
        : { ...baseOptions, persistSession: true },
    } as Parameters<typeof query>[0]);

    try {
      for await (const message of q) {
        // Capture session_id from init message for future resume
        if (message.type === 'system' && 'subtype' in message
            && (message as { subtype?: string }).subtype === 'init'
            && 'session_id' in message) {
          this.sessionId = (message as { session_id: string }).session_id;
        }
        // Capture result text for conversation history
        if (message.type === 'result' && 'result' in message) {
          const resultText = (message as { result?: string }).result?.trim();
          if (resultText) this.lastAssistantText = resultText;
        }
        // Capture assistant text as fallback
        if (message.type === 'assistant' && 'message' in message) {
          const content = (message as { message?: { content?: Array<{ type: string; text?: string }> } }).message?.content;
          if (Array.isArray(content)) {
            const text = content
              .filter(b => b.type === 'text' && b.text)
              .map(b => b.text!)
              .join('\n')
              .trim();
            if (text) this.lastAssistantText = text;
          }
        }
        const events = this.eventMapper.mapMessage(message);
        for (const event of events) {
          yield event;
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg = toErrorMessage(err);
      const errorEvents = this.eventMapper.mapError(errMsg);
      for (const evt of errorEvents) yield evt;
    }
  }

  /** Get the captured SDK session ID (available after run completes) */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /** Get the last assistant response text (for conversation history) */
  getLastAssistantText(): string | undefined {
    return this.lastAssistantText;
  }

  /** Stop the session */
  stop(): void {
    this.abortController.abort();
  }

  /** Get IDs of all spawned subagent Theater agents */
  getSpawnedAgentIds(): string[] {
    return this.eventMapper.getSpawnedAgentIds();
  }
}
