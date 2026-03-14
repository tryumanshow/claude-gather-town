# Architecture — Claude Gather.town

This document describes the internal architecture, data flow, and key design decisions.

## Overview

Claude Gather.town is a TypeScript monorepo with three packages:

- **`@theater/shared`** — Types, constants, protocol definitions, agent roster
- **`@theater/server`** — Express + WebSocket server, Claude Code SDK integration
- **`@theater/client`** — React 18 + Phaser 3 game frontend

All AI interactions use the `@anthropic-ai/claude-agent-sdk` `query()` function. There are no direct `fetch()` calls to the Anthropic API.

---

## Server Architecture

### Request Lifecycle

```
                     ┌──────────────────┐
User Input ────────→ │  CommandParser    │ parse mode, detect target agent
                     └────────┬─────────┘
                              │ ParsedCommand
                     ┌────────▼─────────┐
                     │  SimulationEngine │ route to RealExecutionEngine
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │     Brain        │ SDK query (maxTurns:1, no tools)
                     │  (Intent Class.) │ → { intent, agentId, mode, response }
                     └────────┬─────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
          intent: chat   intent: work  intent: work
                 │        (single)     (subagent/teams)
                 │            │            │
          ┌──────▼──────┐ ┌──▼────┐  ┌────▼──────────────┐
          │ handleChat() │ │Single │  │executeMorganOrch- │
          │ walk+bubble  │ │Session│  │estrated()         │
          └──────────────┘ └──┬────┘  │ Meeting flow +    │
                              │       │ Morgan SDK session │
                         ┌────▼────┐  │ (enableRosterAgents)
                         │AgentSes-│  └────┬──────────────┘
                         │sion.run │       │
                         └────┬────┘  ┌────▼────┐
                              │       │AgentSes-│
                              │       │sion.run │
                              │       └────┬────┘
                              │            │
                         ┌────▼────────────▼────┐
                         │    EventMapper        │
                         │ SDK events → Theater  │
                         │    ServerMessage       │
                         └────────┬──────────────┘
                                  │
                         ┌────────▼─────────┐
                         │  WorldState       │ update agents, tasks, messages
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │  WebSocket        │ broadcast to all clients
                         │  broadcast()      │
                         └──────────────────┘
```

### Key Components

#### Brain (`roster/Brain.ts`)
- Lightweight SDK call: `maxTurns: 1`, no tools, `claude-sonnet-4-6`
- Classifies intent as `chat` or `work`
- Picks best agent by skill matching
- For work: recommends mode (single / subagent / teams) and team composition
- Maintains chat history (max 20 entries) for multi-turn conversation context

#### RealExecutionEngine (`RealExecutionEngine.ts`)
- Orchestrates the full execution lifecycle
- **Chat flow**: Agent walks to player position → shows chat bubble → walks back to seat
- **Single work**: One AgentSession with no Agent tool available
- **Subagent work**: Star pattern (standup → scatter → individual report) → Morgan's AgentSession with `enableRosterAgents: true`
- **Teams work**: Relay pattern (full meeting → desk handoffs → wrap-up meeting) → Morgan's AgentSession with `enableRosterAgents: true`
- Manages agent state transitions (idle → thinking → moving → acting → completed)
- Tracks `lastChatAgentId` for conversation continuity

#### AgentSession (`anthropic/AgentSession.ts`)
- Wraps `query()` from `@anthropic-ai/claude-agent-sdk`
- Builds system prompt: agent persona + codebase awareness + from-scratch flag
- Builds execution prompt based on mode (single / subagent / teams)
- When `enableRosterAgents` is true, registers all roster agents as SDK `AgentDefinition` records
- Permission handling via `canUseTool` callback → returns `{ behavior: 'allow', updatedInput }` or `{ behavior: 'deny', message }`
- Yields `ServerMessage` events via `EventMapper`

#### EventMapper (`anthropic/EventMapper.ts`)
- Converts Claude Code SDK streaming events into Theater `ServerMessage` types
- Maps: `assistant` → `agent:text`, `tool_use` → `agent:tool`, sub-agent spawning → `agent:spawn`
- Generates chat bubbles for agent responses
- Tracks spawned sub-agent IDs

#### WorldState (`WorldState.ts`)
- In-memory store for all game state
- `agents: Map<string, AgentData>` — transient + roster agents
- `rosterAgents: Map<string, AgentData>` — the 14 persistent agents (initialized on startup)
- `tasks: Map<string, TaskData>` — Kanban board items
- `messages: ChatMessageData[]` — chat messages (auto-trimmed to last 100 when exceeding 200)

#### SimulationEngine (`SimulationEngine.ts`)
- Applies `ServerMessage` events to `WorldState`
- Routes commands to `RealExecutionEngine`
- Provides `snapshot()` for client sync on connect

---

## Client Architecture

### Component Hierarchy

```
App
├── SetupScreen (shown if not authenticated)
├── PhaserGame
│   ├── WorldScene (map, agents, player, furniture, backgrounds)
│   └── UIScene (unused, reserved)
├── CommandInput (mode buttons, quick actions, text input)
├── CCLogPanel (SDK execution log)
├── TaskBoard (Kanban: Todo / Doing / Done)
├── RepoBar (repository selector)
├── AgentStatus (agent state display)
├── IDEView (Monaco + file explorer + xterm terminal)
├── PermissionDialog (tool approval)
├── QuestionOverlay (lead question)
├── HelpOverlay
└── ConnectionOverlay
```

### Rendering Pipeline

All game assets are **procedurally generated** — no sprite sheets or image assets are needed:

| Generator | Output | Details |
|-----------|--------|---------|
| `TileGenerator` | 32×32 tile atlas | Floors (lobby, wood, carpet), walls, doors, furniture (desks, chairs, plants, etc.) |
| `SpriteGenerator` | 16×24 character sprites | 4 directions × 3 walk frames per agent type; canvas-drawn head, hair, shirt, pants |
| `FurnitureGenerator` | Furniture placement | Draws furniture objects on tile positions |

### Communication Flow

```
WebSocket Server ──ws:message──→ ws-client.ts ──EventBus.emit──→ WorldScene / React components
                                                                      │
React components ──EventBus.emit──→ ws-client.send() ──────────→ WebSocket Server
```

`EventBus` (Phaser EventEmitter) bridges React and Phaser. All WebSocket messages are re-emitted as `ws:{type}` events.

---

## Shared Package

### Type System

```
AgentType (24 variants)     — orchestrator, executor, planner, scientist, etc.
AgentState (11 variants)    — spawning, idle, thinking, moving, acting, etc.
SimMode (3 variants)        — single, subagent, teams
ZoneName (8 variants)       — planning, code-workshop, review-room, spawn, etc.
ToolType (13 variants)      — Read, Edit, Write, Bash, Grep, Glob, etc.
```

### Protocol

`ServerMessage` is a discriminated union with 22+ event types. Key events:

| Event | Purpose |
|-------|---------|
| `world:snapshot` | Full state sync on client connect |
| `agent:spawn` / `agent:despawn` | Agent lifecycle |
| `agent:move` | Tween-based movement animation |
| `agent:state` | State machine transitions |
| `agent:tool` | SDK tool usage (Read, Edit, Bash, etc.) |
| `agent:text` | Agent text output (thinking, analysis) |
| `agent:chat` | Chat bubble display |
| `task:event` | Kanban board updates |
| `meeting:phase` | Meeting flow (gather / discuss / disperse) |
| `permission:request` | Tool approval dialog |

### Agent Roster

14 agents defined in `agentRoster.ts`, each with:

```typescript
interface RosterAgent {
  id: string;           // 'alex', 'jordan', 'morgan', etc.
  name: string;         // Display name
  role: string;         // Job title
  skills: string[];     // Keyword matching for agent selection
  agentType: AgentType; // Sprite/color type
  color: string;        // Unique hex color
  homeZone: ZoneName;   // Idle position zone
  seatX: number;        // Desk tile X
  seatY: number;        // Desk tile Y
  systemPrompt: string; // Role-specific Claude Code instructions
}
```

---

## Agent State Machine

```
spawning → idle → thinking → moving → acting → completed → despawning
                      │                    │         │
                      └── gathering ──→ discussing ──┘
                                                     │
                                                  failed
```

Roster agents cycle back to `idle` after completion (they never despawn). Transient agents are removed after `despawning`.

---

## Meeting Flow Detail

Subagent and Teams modes have **distinct movement choreography** to be visually distinguishable.

### Common
- **Agent Selection**: Brain picks 2-5 agents based on task + skill matching
- **Meeting Position**: 3+ agents → conference table (x:747, y:280); 1-2 → blue sofa (x:1155, y:260)
- **Walk delays**: Distance-based via `calcWalkDelay()`: `max(800, distance * 2 + 200)` to match client Phaser tween duration
- **Morgan filtered from picked**: Prevents duplication since Morgan is always added as orchestrator

### Subagent Mode — Star Pattern

```
  Standup huddle → Scatter to desks → SDK work → Individual report to Morgan → Return
```

1. **Quick Standup** — All agents gather at meeting position. Morgan opens with `STANDUP_POOL` line. 1-2 agents show standup bubbles. Short (~1200ms).
2. **Scatter** — Each agent shows "Starting work at my desk." and walks back to home seat.
3. **SDK Execution** — Morgan's `AgentSession` runs with `enableRosterAgents: true`.
4. **Individual Report** — Each picked agent walks to Morgan's desk one by one, shows `REPORT_POOL` bubble, then returns to own seat.
5. **Completion** — Morgan shows completion bubble, all return to seats.

### Teams Mode — Relay Pattern

```
  Full meeting → Relay desk visits → SDK work → Wrap-up meeting → Return
```

1. **Full Meeting** — Extended gathering with `DISCUSSION_POOL` messages. Morgan opens kickoff. 2-3 agents show discussion bubbles + `CHECKIN_POOL` lines. Longer (~2000ms).
2. **Relay Handoffs** — Agents visit each other's desks sequentially: agent[i] walks to agent[i+1]'s seat, shows `HANDOFF_POOL` bubble, pauses, returns. Creates visible cross-office movement.
3. **SDK Execution** — Morgan's `AgentSession` runs with `enableRosterAgents: true`.
4. **Wrap-up Meeting** — All agents reconvene at meeting position. Morgan shows wrap-up bubble (~1500ms).
5. **Return** — All agents walk back to home seats.

---

## Background Image Detection

1. User drags an image file onto the game canvas
2. Client resizes to max 3840px, converts to base64 data URL
3. Server's `BackgroundAnalyzer` saves image to temp file
4. Claude Code SDK (with `Read` tool) analyzes the image:
   - Finds desk labels and chair circle positions
   - Returns normalized coordinates (0.0–1.0)
5. Coordinates are converted to world pixels (`nx × MAP_WIDTH × TILE_SIZE`)
6. Agents are repositioned to detected seats
7. Positions are persisted to `bg-seats.json` via `SeatStore`

---

## Codebase Awareness

When a repository is selected, `AwarenessManager` scans files matching each agent's role patterns:

| Agent | File Patterns |
|-------|--------------|
| Alex (Frontend) | `**/*.tsx`, `**/*.css`, `src/components/**` |
| Jordan (Backend) | `**/api/**`, `server/**`, `**/*.sql`, `prisma/**` |
| Sam (DevOps) | `Dockerfile`, `.github/**`, `*.yaml`, `terraform/**` |
| ... | (defined in `AwarenessManager.ts`) |

The scan results are injected into each agent's system prompt as "Project structure (area: ...): ..." context.

---

## Environment & Config

| File | Purpose |
|------|---------|
| `.env` | `ANTHROPIC_API_KEY` (optional, OAuth is default), `WORKING_DIRECTORY`, `ANTHROPIC_MODEL`, `PERMISSION_MODE` |
| `tsconfig.base.json` | Shared TypeScript config (ES2022, strict, declaration maps) |
| `packages/client/vite.config.ts` | Vite dev server (port 5173), `@theater/shared` alias |
| `bg-seats.json` | Persisted agent seat positions from background analysis |

---

## Design Decisions

1. **SDK-only**: All AI interactions go through `@anthropic-ai/claude-agent-sdk` `query()`. No direct API calls.
2. **Procedural assets**: All tiles, sprites, and furniture are generated via canvas — zero external image assets.
3. **Morgan as orchestrator**: In subagent/teams mode, Morgan (CTO) is always the lead agent who delegates to others via SDK's native `AgentDefinition` sub-agent system.
4. **Brain as lightweight classifier**: A single SDK call (maxTurns: 1, no tools) for fast intent classification, separate from the heavier execution sessions.
5. **English code, Korean responses**: All source code, comments, and prompts are in English. Each agent's system prompt includes "Always respond in Korean." for user-facing output.
6. **Roster persistence**: The 14 agents always exist on the map. They return to home seats after tasks complete, never truly despawn.
