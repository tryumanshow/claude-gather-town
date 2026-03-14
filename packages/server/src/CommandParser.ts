import type { SimMode, AgentType, ToolType } from '@theater/shared';
import { AGENT_ROSTER } from '@theater/shared';

export interface ParsedCommand {
  mode: SimMode;
  description: string;
  targetAgent?: string;  // roster agent id if user mentioned a specific person
  options: {
    parallel?: number;
    size?: number;
    types?: AgentType[];
    roles?: AgentType[];
    tools?: ToolType[];
    preset?: string;
  };
}

export class CommandParser {
  /** Detect if user mentioned a specific roster agent by name or role keyword */
  private static detectTargetAgent(text: string): string | undefined {
    const lower = text.toLowerCase();
    for (const agent of AGENT_ROSTER) {
      if (lower.includes(agent.name.toLowerCase())) return agent.id;
      if (lower.includes(agent.id.toLowerCase()) && agent.id.length > 2) return agent.id;
      // Check role keywords (e.g. 'CTO', 'Tech Lead', 'Frontend')
      const roleKeywords = agent.role.split(/[\/,]/).map(s => s.trim().toLowerCase()).filter(k => k.length > 2);
      if (roleKeywords.some(k => lower.includes(k))) return agent.id;
    }
    return undefined;
  }

  parse(raw: string): ParsedCommand | null {
    const trimmed = raw.trim();

    // Preset commands
    if (trimmed.startsWith('/preset ')) {
      return this.parsePreset(trimmed);
    }

    // Control commands (handled separately)
    if (/^\/(speed|reset)/.test(trimmed)) {
      return null; // Handled as control messages
    }

    // Explicit mode commands
    if (trimmed.startsWith('/single')) {
      return this.parseSingle(trimmed);
    }
    if (trimmed.startsWith('/subagent')) {
      return this.parseSubAgent(trimmed);
    }
    if (trimmed.startsWith('/team')) {
      return this.parseTeam(trimmed);
    }

    // Default: everything goes to single agent — Claude decides how to respond
    const targetAgent = CommandParser.detectTargetAgent(trimmed);

    return {
      mode: 'single',
      description: trimmed.startsWith('/') ? trimmed.slice(1) : trimmed,
      targetAgent,
      options: {},
    };
  }

  private parseSingle(raw: string): ParsedCommand {
    const toolsMatch = raw.match(/--tools\s+([\w,]+)/);
    const descMatch = raw.match(/"([^"]+)"/);

    const tools = toolsMatch
      ? toolsMatch[1].split(',').map(t => t.trim()) as ToolType[]
      : undefined;

    return {
      mode: 'single',
      description: descMatch?.[1] || raw.replace(/^\/single\s*/, '').trim() || 'Execute task',
      options: { tools },
    };
  }

  private parseSubAgent(raw: string): ParsedCommand {
    const parallelMatch = raw.match(/--parallel\s+(\d+)/);
    const typesMatch = raw.match(/--types\s+([\w,-]+)/);
    const descMatch = raw.match(/"([^"]+)"/);

    return {
      mode: 'subagent',
      description: descMatch?.[1] || raw.replace(/^\/subagent\s*/, '').trim() || 'Explore and analyze',
      options: {
        parallel: parallelMatch ? parseInt(parallelMatch[1]) : 2,
        types: typesMatch
          ? typesMatch[1].split(',').map(t => t.trim()) as AgentType[]
          : undefined,
      },
    };
  }

  private parseTeam(raw: string): ParsedCommand {
    const sizeMatch = raw.match(/--size\s+(\d+)/);
    const rolesMatch = raw.match(/--roles\s+([\w,-]+)/);
    const presetMatch = raw.match(/--preset\s+([\w-]+)/);
    const descMatch = raw.match(/"([^"]+)"/);

    return {
      mode: 'teams',
      description: descMatch?.[1] || raw.replace(/^\/team\s*/, '').trim() || 'Team collaboration',
      options: {
        size: sizeMatch ? parseInt(sizeMatch[1]) : 3,
        roles: rolesMatch
          ? rolesMatch[1].split(',').map(t => t.trim()) as AgentType[]
          : undefined,
        preset: presetMatch?.[1],
      },
    };
  }

  private parsePreset(raw: string): ParsedCommand {
    const presetName = raw.replace('/preset ', '').trim();

    const presets: Record<string, ParsedCommand> = {
      'single-debug': {
        mode: 'single',
        description: 'Debug: Read file, search for bug, fix, test',
        options: {},
      },
      'single-refactor': {
        mode: 'single',
        description: 'Refactor: Analyze code, restructure, verify',
        options: {},
      },
      'subagent-explore': {
        mode: 'subagent',
        description: 'Parallel codebase exploration',
        options: { parallel: 3, types: ['explorer', 'explorer', 'explorer'] },
      },
      'subagent-implement': {
        mode: 'subagent',
        description: 'Research, implement, and review',
        options: { parallel: 3, types: ['explorer', 'executor', 'reviewer'] },
      },
      'team-feature': {
        mode: 'teams',
        description: 'Full feature development lifecycle',
        options: {
          size: 5,
          roles: ['orchestrator', 'planner', 'executor', 'executor', 'reviewer']
        },
      },
      'team-review': {
        mode: 'teams',
        description: 'Comprehensive code review',
        options: {
          size: 4,
          roles: ['orchestrator', 'reviewer', 'security-reviewer', 'test-engineer']
        },
      },
    };

    return presets[presetName] || {
      mode: 'single',
      description: `Unknown preset: ${presetName}`,
      options: {},
    };
  }
}
