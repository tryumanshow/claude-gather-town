// Agent types matching Claude Code's agent catalog
export type AgentType =
  | 'orchestrator' | 'executor' | 'explorer' | 'planner'
  | 'architect' | 'reviewer' | 'debugger' | 'writer'
  | 'single' | 'build-fixer' | 'test-engineer' | 'designer'
  | 'security-reviewer' | 'scientist' | 'document-specialist'
  | 'code-reviewer' | 'quality-reviewer' | 'qa-tester'
  | 'git-master' | 'code-simplifier' | 'critic'
  | 'analyst' | 'verifier' | 'deep-executor';

// Agent states matching the state machine
export type AgentState =
  | 'spawning' | 'idle' | 'thinking' | 'moving'
  | 'acting' | 'communicating' | 'completed' | 'failed' | 'despawning'
  | 'gathering' | 'discussing';

// Tool types matching Claude Code's tool set
export type ToolType =
  | 'Read' | 'Edit' | 'Write' | 'Bash' | 'Grep' | 'Glob'
  | 'WebSearch' | 'WebFetch' | 'Task' | 'SendMessage'
  | 'TaskCreate' | 'TaskUpdate' | 'TeamCreate';

// Zone names on the map
export type ZoneName =
  | 'spawn' | 'planning' | 'code-workshop' | 'research-lab'
  | 'review-room' | 'tool-forge' | 'message-center' | 'task-board';

// Simulation modes
export type SimMode = 'single' | 'subagent' | 'teams';

// Task status matching Claude Code's task lifecycle
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// Direction for sprite animation
export type Direction = 'up' | 'down' | 'left' | 'right';

// Core agent data
export interface AgentData {
  id: string;
  type: AgentType;
  state: AgentState;
  displayName: string;
  role: string;
  color: string;
  x: number;
  y: number;
  direction: Direction;
  parentId?: string;
  teamId?: string;
  currentTool?: ToolType;
  currentZone?: ZoneName;
}

// Task data for kanban board (all modes)
export interface TaskData {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  ownerColor?: string;
  blockedBy: string[];
  teamId: string;
}

// Chat message
export interface ChatMessageData {
  id: string;
  fromId: string;
  toId: string | 'broadcast';
  content: string;
  summary: string;
  timestamp: number;
}

// Zone definition
export interface ZoneDefinition {
  name: ZoneName;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}
