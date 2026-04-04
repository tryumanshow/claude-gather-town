import type { AgentData, AgentState, AgentType, ChatMessageData, SimMode, TaskData, TaskStatus, ToolType, ZoneName } from './types.js';

// === Server → Client Messages ===

export interface WorldSnapshotPayload {
  tick: number;
  agents: AgentData[];
  tasks: TaskData[];
  messages: ChatMessageData[];
  mode: SimMode | null;
  speed: number;
}

export interface AgentSpawnPayload {
  agentId: string;
  agentType: AgentType;
  role: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  parentId?: string;
  teamId?: string;
  rosterId?: string;  // links to RosterAgent.id for persistent agents
}

export interface RosterInitPayload {
  agents: Array<{
    id: string;
    name: string;
    role: string;
    agentType: AgentType;
    color: string;
    homeZone: ZoneName;
    state: AgentState;
  }>;
}

export interface AgentMovePayload {
  agentId: string;
  targetX: number;
  targetY: number;
  targetZone: ZoneName;
  path: [number, number][];
}

export interface AgentStatePayload {
  agentId: string;
  state: AgentState;
  detail?: string;
}

export interface ToolUsePayload {
  agentId: string;
  tool: ToolType;
  description: string;
  duration: number;
  result?: string;
  filePath?: string;
}

export interface AgentChatPayload {
  agentId: string;
  text: string;
  duration?: number;
}

export interface AgentDespawnPayload {
  agentId: string;
  reason: 'completed' | 'failed' | 'shutdown';
}

export interface MessageSendPayload {
  id: string;
  fromId: string;
  toId: string | 'broadcast';
  content: string;
  summary: string;
}

export interface TaskEventPayload {
  task: TaskData;
  action: 'create' | 'update' | 'complete' | 'assign';
}

export interface SimStatusPayload {
  mode: SimMode | null;
  speed: number;
  agentCount: number;
  taskCount: number;
}

export interface LogEventPayload {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
}

export interface LeadQuestionPayload {
  id: string;
  question: string;
  options: { label: string; description: string }[];
}

export interface RepoStatusPayload {
  path: string | null;
  name: string;
  isGitRepo: boolean;
  currentBranch?: string;
  hasChanges?: boolean;
  diffSummary?: string;
  changedFiles?: string[];
  fromScratch: boolean;
}

export interface MeetingPhasePayload {
  phase: 'gather' | 'discuss' | 'disperse';
  agentIds: string[];
  zone: ZoneName;
  taskSummary?: string;
}

export interface AgentTextPayload {
  agentId: string;
  text: string;
  role: 'assistant' | 'tool_result' | 'system';
}

export interface AgentPermissionPayload {
  permissionId: string;
  agentId: string;
  toolName: string;
  description: string;
  input: Record<string, unknown>;
}

export interface AuthStatusPayload {
  configured: boolean;
  method?: 'oauth' | 'apikey';
  claudeInstalled?: boolean;
}

// === Agent-to-Agent Communication ===

export interface AgentToAgentPayload {
  fromAgentId: string;
  toAgentId: string;
  message: string;
  /** Visual: sender walks to receiver's desk */
  walkToDesk?: boolean;
}

// === Agent Performance Stats ===

export interface AgentStatsPayload {
  agents: AgentStatEntry[];
}

export interface AgentStatEntry {
  agentId: string;
  agentName: string;
  color: string;
  tasksCompleted: number;
  tasksFailed: number;
  toolUsage: Record<string, number>;
  totalSessionTimeMs: number;
  lastActiveAt?: number;
}

// === File Browser (IDE View) ===

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FileListResultPayload {
  dirPath: string;
  entries: FileEntry[];
  error?: string;
}

export interface FileReadResultPayload {
  filePath: string;
  content: string;
  language: string;
  error?: string;
}

// === Terminal ===

export interface TerminalDataPayload {
  terminalId: string;
  data: string;
}

export interface TerminalExitPayload {
  terminalId: string;
  exitCode: number;
}

export type ServerMessage =
  | { type: 'setup:auth_status'; payload: AuthStatusPayload }
  | { type: 'world:snapshot';   payload: WorldSnapshotPayload }
  | { type: 'agent:spawn';     payload: AgentSpawnPayload }
  | { type: 'agent:move';      payload: AgentMovePayload }
  | { type: 'agent:state';     payload: AgentStatePayload }
  | { type: 'agent:tool';      payload: ToolUsePayload }
  | { type: 'agent:chat';      payload: AgentChatPayload }
  | { type: 'agent:despawn';   payload: AgentDespawnPayload }
  | { type: 'message:send';    payload: MessageSendPayload }
  | { type: 'task:event';      payload: TaskEventPayload }
  | { type: 'sim:status';      payload: SimStatusPayload }
  | { type: 'sim:log';         payload: LogEventPayload }
  | { type: 'lead:question';   payload: LeadQuestionPayload }
  | { type: 'roster:init';     payload: RosterInitPayload }
  | { type: 'repo:status';     payload: RepoStatusPayload }
  | { type: 'meeting:phase';   payload: MeetingPhasePayload }
  | { type: 'agent:text';      payload: AgentTextPayload }
  | { type: 'agent:permission'; payload: AgentPermissionPayload }
  | { type: 'file:list:result'; payload: FileListResultPayload }
  | { type: 'file:read:result'; payload: FileReadResultPayload }
  | { type: 'terminal:data'; payload: TerminalDataPayload }
  | { type: 'terminal:exit'; payload: TerminalExitPayload }
  | { type: 'agent:talk'; payload: AgentToAgentPayload }
  | { type: 'stats:update'; payload: AgentStatsPayload };

// === Client → Server Messages ===

export interface CommandPayload {
  raw: string;
  playerX?: number;
  playerY?: number;
  mode?: 'single' | 'subagent' | 'teams';
  targetAgent?: string;  // explicit agent name/id from user mention
}

export interface ControlPayload {
  action: 'reset' | 'speed';
  value?: number;
}

export interface QuestionAnswerPayload {
  questionId: string;
  optionIndex: number;
}

export interface BgAnalyzePayload {
  imageData: string;
  imageWidth: number;
  imageHeight: number;
  force?: boolean; // true = always call Claude API (new image drag), false/omit = use saved seats if available
}

export interface PlayerPermissionAnswerPayload {
  permissionId: string;
  approved: boolean;
}

export type ClientMessage =
  | { type: 'command'; payload: CommandPayload }
  | { type: 'control'; payload: ControlPayload }
  | { type: 'question:answer'; payload: QuestionAnswerPayload }
  | { type: 'repo:select'; payload: { path: string; action: 'select' | 'scratch' } }
  | { type: 'bg:analyze'; payload: BgAnalyzePayload }
  | { type: 'player:permission_answer'; payload: PlayerPermissionAnswerPayload }
  | { type: 'setup:set_apikey'; payload: { apiKey: string } }
  | { type: 'setup:check_oauth'; payload: Record<string, never> }
  | { type: 'file:list'; payload: { dirPath: string } }
  | { type: 'file:read'; payload: { filePath: string } }
  | { type: 'terminal:spawn'; payload: { cwd?: string } }
  | { type: 'terminal:input'; payload: { terminalId: string; data: string } }
  | { type: 'terminal:resize'; payload: { terminalId: string; cols: number; rows: number } }
  | { type: 'terminal:kill'; payload: { terminalId: string } };
