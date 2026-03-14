# Claude Gather.town

A virtual office where AI agents collaborate visually. Watch a team of 14 specialized Claude-powered agents walk, meet, and code together in a Gather Town-style environment — powered entirely by the [Claude Code SDK](https://docs.anthropic.com/en/docs/claude-code-sdk).

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Phaser](https://img.shields.io/badge/Phaser-3.87-green)
![React](https://img.shields.io/badge/React-18-61dafb)
![Claude Code SDK](https://img.shields.io/badge/Claude_Code_SDK-0.2.71-blueviolet)

## Demo

https://github.com/user-attachments/assets/3a157622-352f-4942-9750-bfeab9d5e744

## What is this?

Type a natural language command, and the system:

1. **Classifies** your intent (chat vs. work) using a lightweight Claude Code SDK call
2. **Selects** the best agent(s) based on skill matching
3. **Executes** the task via Claude Code SDK with real file operations (Read, Edit, Write, Bash, Grep, etc.)
4. **Visualizes** everything — agents walk between zones, hold meetings, and update a live task board

All AI interactions — from intent classification to multi-agent orchestration — use the `@anthropic-ai/claude-agent-sdk` `query()` function. There are no direct Anthropic API calls.

## Execution Modes

All three modes directly call the Claude Code SDK's [subagents and agent teams](https://docs.anthropic.com/en/docs/claude-code/agent-sdk#subagents-and-agent-teams) capabilities — the same multi-agent primitives available in the SDK.

### Single

One agent works alone on the task. Brain selects the best-fit agent by skill matching and that agent runs a single `AgentSession` (SDK `query()` call). Best for focused, scoped work.

**Use cases**: Debugging, quick fixes, single-file edits, code explanations

### Subagent — Star Pattern

Morgan (CTO) orchestrates 2-4 agents using the SDK's **subagent** spawning. The visual choreography follows a **star pattern**: all agents huddle briefly, scatter to their desks, work independently, then report back to Morgan one by one.

```
Standup huddle → Scatter to desks → Parallel SDK work → Individual report to Morgan → Return
```

Morgan's `AgentSession` runs with `enableRosterAgents: true`, registering each roster agent as an SDK `AgentDefinition`. The SDK spawns sub-agents on demand via the `Agent` tool. Best for tasks that benefit from multiple perspectives but can be parallelized.

**Use cases**: Codebase exploration, multi-file analysis, broad code review

### Teams — Relay Pattern

Morgan orchestrates a full team collaboration using the SDK's **agent teams** pattern. The visual choreography follows a **relay pattern**: an extended meeting with discussion, sequential desk-to-desk handoffs between agents, SDK work, and a wrap-up meeting.

```
Full meeting → Relay desk visits → SDK work → Wrap-up meeting → Return
```

The relay handoffs create visible cross-office movement — agent[i] visits agent[i+1]'s desk before work begins. Best for tasks that require coordinated, interdependent work.

**Use cases**: Feature development, complex refactors, cross-cutting changes

## The Team (14 Agents)

| Zone | Agent | Role | Skills |
|------|-------|------|--------|
| Planning | **Morgan** | CTO / Tech Lead | Architecture, Code Review, System Design |
| Planning | **Sujin** | Product Manager | Product, Roadmap, PRD, User Story |
| Code Workshop | **Alex** | Frontend Engineer | React, TypeScript, CSS, UI/UX |
| Code Workshop | **Jordan** | Backend Engineer | Node.js, Python, API, Database |
| Code Workshop | **Hana** | Full-Stack Developer | React, Node.js, API, End-to-End |
| Code Workshop | **Taeho** | Mobile Engineer | iOS, Android, React Native, Flutter |
| Review Room | **Riley** | QA Engineer | Testing, E2E, Coverage, Bug Analysis |
| Review Room | **Yuna** | UI/UX Designer | Design, Figma, Prototype, Accessibility |
| Research Lab | **Casey** | Data Engineer | Pipeline, ETL, BigQuery, Spark |
| Research Lab | **Seungwoo** | AI/ML Engineer | PyTorch, LLM, NLP, Training |
| Research Lab | **Dana** | Security Engineer | OWASP, Auth, Vulnerability, Audit |
| Tool Forge | **Sam** | DevOps / SRE | Docker, CI/CD, AWS, Kubernetes |
| Tool Forge | **Minjun** | Platform Engineer | SDK, DX, Build System, Tooling |
| Message Center | **Nari** | Technical Writer | API Docs, Guide, README, Tutorial |

Each agent has a unique system prompt, skill set, and home zone. The [Brain](#how-it-works) automatically selects the best agent(s) for each task.

## Quick Start

### Prerequisites

- Node.js 20+
- `claude` CLI installed and logged in ([Claude Code](https://docs.anthropic.com/en/docs/claude-code))

### Authentication

The app uses **Claude Code OAuth** — the same authentication as the `claude` CLI. No separate API key is needed.

On first launch, a setup screen appears with two options:

1. **OAuth (recommended)**: If `claude` CLI is already logged in, click "Use Claude Code OAuth" and you're done.
2. **API Key (fallback)**: Paste an `ANTHROPIC_API_KEY` (`sk-ant-...`) directly. This is saved to `.env` for persistence.

### Setup

```bash
git clone https://github.com/tryumanshow/claude-gather-town.git
cd claude-gather-town
npm install

# Start dev server (server + client)
npm run dev
```

Open `http://localhost:5173` in your browser.

### First Steps

1. Complete auth on the **SetupScreen** (OAuth or API key)
2. Select a repository in the **RepoBar** (top-right of the panel)
3. Choose a mode (**Single** / **Subagent** / **Teams**) or a Quick Action chip
4. Type a task and press Send
5. Watch agents collaborate in real time

## Architecture

```
claude-gather-town/
├── packages/
│   ├── shared/          # Types, agent roster, protocol, zone config
│   │   ├── types.ts              # AgentData, TaskData, AgentType, ServerMessage, etc.
│   │   ├── protocol.ts           # WebSocket message protocol (22+ server, 12+ client types)
│   │   ├── agentRoster.ts        # 14 agent definitions (RosterAgent[])
│   │   ├── zoneConfig.ts         # 8 zone definitions (tile coordinates)
│   │   ├── uiConfig.ts           # TILE_SIZE, AGENT_COLORS, AGENT_NAMES, TIMING
│   │   └── utils.ts              # getZoneCenter()
│   ├── server/          # Express + WebSocket server, Claude Code SDK integration
│   │   ├── index.ts              # Express server + WebSocket handlers
│   │   ├── SimulationEngine.ts   # World state management + event dispatch
│   │   ├── WorldState.ts         # In-memory agent/task/message store
│   │   ├── RealExecutionEngine.ts # Brain → mode router → SDK execution
│   │   ├── CommandParser.ts      # NLP-lite command parsing
│   │   ├── RepoManager.ts        # Working directory + git status tracking
│   │   ├── AwarenessManager.ts   # Per-agent codebase awareness
│   │   ├── BackgroundAnalyzer.ts  # AI-powered floor plan seat detection
│   │   ├── SeatStore.ts          # Persist agent seats to JSON
│   │   ├── roster/
│   │   │   ├── Brain.ts          # Intent classification + agent selection (SDK)
│   │   │   └── pickAgents.ts     # Skill-based agent scoring
│   │   └── anthropic/
│   │       ├── AgentSession.ts   # Claude Code SDK query() wrapper
│   │       └── EventMapper.ts    # SDK events → Theater ServerMessage
│   └── client/          # Phaser.js game + React UI
│       ├── App.tsx               # Main layout (game + panels)
│       ├── PhaserGame.tsx        # Phaser.Game initialization
│       ├── ws-client.ts          # WebSocket client (auto-reconnect)
│       ├── EventBus.ts           # React ↔ Phaser pub-sub
│       ├── bg-db.ts              # IndexedDB for background image persistence
│       ├── game/
│       │   ├── scenes/WorldScene.ts  # Map rendering, agent sprites, movement
│       │   ├── SpriteGenerator.ts    # Procedural 16×24 character sprites
│       │   ├── TileGenerator.ts      # Procedural 32×32 tileset
│       │   └── FurnitureGenerator.ts # Procedural furniture placement
│       └── components/
│           ├── CommandInput.tsx       # Mode buttons + quick actions + input
│           ├── TaskBoard.tsx          # Kanban board (Todo/Doing/Done)
│           ├── CCLogPanel.tsx         # Claude Code execution log
│           ├── IDEView.tsx            # Monaco editor + file explorer + terminal
│           ├── RepoBar.tsx            # Repository selector
│           ├── AgentStatus.tsx        # Agent status display
│           ├── SetupScreen.tsx        # Auth setup (API key / OAuth)
│           ├── PermissionDialog.tsx   # Tool use approval dialog
│           ├── HelpOverlay.tsx        # Help text overlay
│           ├── QuestionOverlay.tsx    # Lead question overlay
│           └── ConnectionOverlay.tsx  # Connection status indicator
```

### How It Works

```
User Input (CommandInput)
    ↓
Brain (Claude Code SDK, maxTurns: 1)
    ├── intent: chat  →  Agent walks to player → chat bubble → walks back
    └── intent: work  →  Mode Router
                            ├── Single    → 1 AgentSession (SDK query)
                            ├── Subagent  → Morgan orchestrates N SDK sub-agents
                            └── Teams     → Morgan uses TeamCreate/TaskCreate/SendMessage
                         ↓
                     AgentSession.run() → SDK query() → EventMapper
                         ↓
                     ServerMessage events → WebSocket broadcast
                         ↓
                     Client: WorldScene (animation) + TaskBoard + CCLogPanel
```

### WebSocket Message Flow

```
Client → Server                    Server → Client
─────────────────                  ─────────────────
command (user input)               world:snapshot (full state sync)
control (pause/resume/reset)       agent:spawn / agent:despawn
repo:select (working dir)          agent:move / agent:state
bg:analyze (floor plan image)      agent:tool / agent:text / agent:chat
file:list / file:read              task:event (kanban updates)
terminal:spawn/input/resize/kill   meeting:phase (gather/discuss/disperse)
setup:set_apikey / check_oauth     sim:log / sim:status / sim:error
permission:response                permission:request / question:ask
```

### Meeting Flow (Subagent / Teams)

When multiple agents collaborate, a visible meeting sequence plays:

1. **Gather** (600ms): Agents walk from home zones to the conference table (3+ agents) or sofa area (1-2 agents)
2. **Discuss** (3000ms): Morgan announces the plan and selected team members
3. **Disperse** (400ms): Agents return to their desks and begin parallel work

## Features

- **Virtual Office**: 2D pixel-art office with 8 zones — procedurally generated tileset, furniture, and character sprites
- **Live Agent Movement**: Agents walk to relevant zones based on the tools they use
- **Meeting Flow**: Multi-agent tasks trigger visible meetings (gather → discuss → disperse)
- **Task Board**: Real-time Kanban board (Todo → Doing → Done) with agent color badges
- **CC Execution Log**: Full Claude Code SDK tool usage log, color-coded by type
- **IDE View**: Built-in IDE with Monaco Editor + file explorer + integrated terminal (xterm.js) — browse agent-generated code, inspect files, and run commands directly in the browser
- **Custom Backgrounds**: Drag & drop floor plan images; AI detects desk positions and repositions agents
- **Smart Agent Selection**: Skill-based matching picks the right agent(s) for each task
- **Quick Actions**: One-click presets — Team Feature, Debug, Explore, Code Review, Refactor
- **Multi-turn Chat**: Brain maintains conversation history for natural multi-turn dialogue
- **Codebase Awareness**: Each agent's system prompt includes relevant file structure from the selected repo
- **Permission Control**: Tool use approval dialog with 30-second auto-deny timeout
- **Player Character**: Move with arrow keys; agents walk to your position for chat interactions

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | API key fallback (not needed if using Claude Code OAuth) |
| `WORKING_DIRECTORY` | No | Default working directory for agents |
| `ANTHROPIC_MODEL` | No | Override model (default: auto-selected by SDK) |
| `PERMISSION_MODE` | No | `acceptEdits` or `bypassPermissions` |

## Scripts

```bash
npm run dev       # Start dev server (server:3001 + client:5173)
npm run build     # Build all packages (shared → server → client)
npm run clean     # Remove dist + node_modules
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Engine** | Claude Code SDK (`@anthropic-ai/claude-agent-sdk` v0.2.71) |
| **Frontend** | React 18, Phaser 3.87, Monaco Editor, xterm.js, Vite |
| **Backend** | Express, WebSocket (ws), Node.js |
| **Shared** | TypeScript 5.7 monorepo with npm workspaces |

## License

MIT
