# Claude Gather.town — Test Cases

## Prerequisites

1. `cd ~/claude-gather-town && npm run dev`
2. Open `http://localhost:5173` in a browser
3. Select a repository via the RepoBar (right panel, top)

---

## TC1. Brain Intent Classification & Agent Selection

### TC1-1. Greeting → chat intent
| Field | Details |
|-------|---------|
| Input | `Hello!` |
| Expected | Brain (SDK `query()`, maxTurns: 1, no tools) classifies as `intent: chat` → agent walks to player position → shows Korean greeting in chat bubble → walks back to home seat |
| Verify | No tool calls in CC Execution Log; no TaskBoard items; agent returns to seat with `idle` state |

### TC1-2. Casual question → chat intent
| Field | Details |
|-------|---------|
| Input | `What should we work on today?` |
| Expected | Brain picks a relevant agent (likely Morgan or Sujin) → walks to player → responds naturally in Korean → walks back |
| Verify | No SDK tool usage in CC Log; Brain selects agent based on skill matching |

### TC1-3. Named agent → targeted chat
| Field | Details |
|-------|---------|
| Input | `Alex, hello!` |
| Expected | **Alex** (Frontend Engineer, blue #4A90D9) specifically selected — Brain's `targetAgent` detection matches "Alex" in `AGENT_ROSTER` |
| Verify | Alex's color badge shown in CC Log; other agents stay at their seats |

### TC1-4. Role keyword → targeted selection
| Field | Details |
|-------|---------|
| Input | `CTO, what's the architecture look like?` |
| Expected | **Morgan** (CTO / Tech Lead) is selected via `CommandParser.detectTargetAgent()` matching "CTO" role keyword |
| Verify | Morgan's color badge (#F39C12) shown |

### TC1-5. Work request → single mode
| Field | Details |
|-------|---------|
| Input | `List the dependencies in package.json` |
| Expected | Brain classifies `intent: work` → agent walks to player → shows "On it!" bubble → `agent:state: thinking` → SDK `query()` executes → CC Log shows `Read: package.json` → task Done → agent returns to seat |
| Verify | TaskBoard shows item: pending → in_progress → completed; CC Log shows Read tool call |

### TC1-6. Named agent + work
| Field | Details |
|-------|---------|
| Input | `Jordan, analyze the structure of server/src/index.ts` |
| Expected | **Jordan** (Backend Engineer, green #2ECC71) selected and executes |
| Verify | Jordan uses Read tool in CC Log; TaskBoard shows Jordan's name + color badge |

### TC1-7. Multi-turn conversation continuity
| Field | Details |
|-------|---------|
| Input | 1st: `Seungwoo, hi!` → 2nd: `Tell me more about your ML work` |
| Expected | 1st: Seungwoo responds with greeting. 2nd: **Seungwoo** again (via `lastChatAgentId` + Brain's "Previously chatting agent" hint) → references first conversation context |
| Verify | Brain's `chatHistory` includes both turns; same agent handles both; response is contextually connected |

### TC1-8. Web search → always work
| Field | Details |
|-------|---------|
| Input | `Search for the latest React 19 features` |
| Expected | Brain classifies as `intent: work` (rule: web search requests → always "work") → agent executes with WebSearch tool |
| Verify | CC Log shows WebSearch tool call |

---

## TC2. Subagent Mode

### TC2-1. Subagent button + work input (Star Pattern)
| Field | Details |
|-------|---------|
| Action | Click **🤖 Subagent** mode button → type: `Analyze the package structure and dependencies of this project` → Send |
| Expected | **Star pattern choreography**: 1) Morgan announces team 2) **Quick standup**: all agents gather at meeting position (conference table or sofa) → Morgan says standup opener from `STANDUP_POOL` → 1-2 agents show standup bubbles → 1200ms 3) **Scatter**: agents disperse to their home desks with "Starting work at my desk." bubble 4) Morgan's SDK session runs (`enableRosterAgents: true`, `maxTurns: 100`) 5) **Individual report**: each agent walks to Morgan's desk one by one, shows report bubble from `REPORT_POOL`, then returns to own seat 6) Morgan shows completion bubble → all agents return to seats |
| Verify | Movement: gather → scatter → (SDK work) → individual walk-to-Morgan → return. Distance-based delays via `calcWalkDelay()`: `max(800, distance * 2 + 200)` |

### TC2-2. Explore Quick Action chip
| Field | Details |
|-------|---------|
| Action | Click **🔍 Explore** chip (empty input) → placeholder changes to `[🔍 Explore] 탐색할 내용을 설명하세요...` → type task → Send |
| Expected | Runs in Subagent mode (Explore chip → `mode: 'subagent'`); mode selector shows Subagent highlighted |
| Verify | Meeting flow plays; multiple agents work in parallel |

### TC2-3. Explicit /subagent command
| Field | Details |
|-------|---------|
| Input | `/subagent "Find all TypeScript type errors in the project"` |
| Expected | Parsed as `mode: subagent`, `description: "Find all TypeScript type errors in the project"`, `parallel: 2` (default) |

---

## TC3. Teams Mode

### TC3-1. Teams button + work input (Relay Pattern)
| Field | Details |
|-------|---------|
| Action | Click **👥 Teams** mode button → type: `Add a filtering feature to the TaskBoard component` → Send |
| Expected | **Relay pattern choreography**: 1) Morgan announces team 2) **Full meeting**: all agents gather → Morgan opens with kickoff from `DISCUSSION_POOL` → 2-3 agents show extended discussion bubbles → check-in bubbles from `CHECKIN_POOL` → 2000ms 3) **Relay handoffs**: agents visit each other's desks sequentially (agent[i] walks to agent[i+1]'s seat, shows handoff bubble from `HANDOFF_POOL`, pauses, returns) 4) Morgan's SDK session runs (`enableRosterAgents: true`, `maxTurns: 100`) 5) **Wrap-up meeting**: all agents reconvene at meeting position → Morgan shows wrap-up bubble → 1500ms → all return to seats |
| Verify | Movement: gather → (extended discuss) → relay desk visits → (SDK work) → reconvene → return. More total movement than subagent star pattern |

### TC3-2. Team Feature Quick Action chip
| Field | Details |
|-------|---------|
| Action | Click **🚀 Team Feature** chip → type: `Add per-agent filtering to CC Log Panel` → Send |
| Expected | Runs in Teams mode; meeting flow + Morgan orchestrates |

### TC3-3. Explicit /team command
| Field | Details |
|-------|---------|
| Input | `/team --size 4 "Implement user authentication"` |
| Expected | Parsed as `mode: teams`, `size: 4`; Brain assembles 4-person team |

---

## TC4. Command Parser & Presets

### TC4-1. /preset single-debug
| Field | Details |
|-------|---------|
| Input | `/preset single-debug` |
| Expected | Runs in Single mode with description "Debug: Read file, search for bug, fix, test" |

### TC4-2. /preset team-feature
| Field | Details |
|-------|---------|
| Input | `/preset team-feature` |
| Expected | Runs in Teams mode with 5 agents: orchestrator, planner, executor ×2, reviewer |

### TC4-3. Unknown preset fallback
| Field | Details |
|-------|---------|
| Input | `/preset unknown-thing` |
| Expected | Falls back to Single mode with "Unknown preset: unknown-thing" |

---

## TC5. UI/UX

### TC5-1. Buttons always enabled on first load
| Field | Details |
|-------|---------|
| Action | Open the app without selecting a repo |
| Expected | All mode buttons (Single, Subagent, Teams) and Quick Action chips are active and clickable (opacity: 1, cursor: pointer). RepoManager initializes with HOME directory fallback. |

### TC5-2. Agents panel collapsed by default
| Field | Details |
|-------|---------|
| Action | Open the app and check the Agents sidebar |
| Expected | AgentStatus panel starts collapsed (default `useState(true)`) |

### TC5-2b. Quick Reference closed by default
| Field | Details |
|-------|---------|
| Action | Open the app and check top-right corner |
| Expected | HelpOverlay shows only the "?" button (default `useState(false)`); press H or click to expand |

### TC5-3. Quick Action chip empty → sets mode + focus
| Field | Details |
|-------|---------|
| Action | Click **🐛 Debug** chip with empty input |
| Expected | Chip shows active state (2px bold border, brighter color); `selectedMode` set to `single`; placeholder changes to `[🐛 Debug] 디버깅할 버그를 설명하세요...`; textarea receives focus |

### TC5-4. Quick Action chip with text → immediate submit
| Field | Details |
|-------|---------|
| Action | Type "Fix the null pointer error" → Click **🐛 Debug** chip |
| Expected | Immediately submits with `mode: single` (Debug's mode); input clears; `activeAction` resets |

### TC5-5. Mode button toggle
| Field | Details |
|-------|---------|
| Action | Click **🤖 Subagent** → click **🤖 Subagent** again |
| Expected | First click: Subagent selected (border glow). Second click: deselected (mode = null) |

### TC5-6. TaskBoard shows agent info
| Field | Details |
|-------|---------|
| Action | Run a task in Single mode |
| Expected | TaskBoard card shows: task description + owner name + color badge matching agent's `roster.color` |

### TC5-7. CC Execution Log color coding
| Field | Details |
|-------|---------|
| Action | Run a work task and observe CC Log |
| Expected | Tool calls in cyan; state changes in yellow; log messages in gray; agent name + color badge per entry |

### TC5-8. Command history
| Field | Details |
|-------|---------|
| Action | Submit "hello" then "fix the bug" → press Arrow Up twice → Arrow Down once |
| Expected | Arrow Up 1: "fix the bug". Arrow Up 2: "hello". Arrow Down 1: "fix the bug" |

---

## TC6. View Switching (Office / IDE)

### TC6-1. Toggle to IDE view
| Field | Details |
|-------|---------|
| Action | Click **IDE** button in the header |
| Expected | IDE overlay: file explorer (left) + Monaco editor (center) + xterm terminal (right) |
| Verify | Office overlays hidden in IDE mode |

### TC6-2. Toggle back to Office view
| Field | Details |
|-------|---------|
| Action | Click **Office** button in the header |
| Expected | Office view returns; agent positions intact; no layout shift |

### TC6-3. IDE file read
| Field | Details |
|-------|---------|
| Action | In file explorer, click a `.ts` file |
| Expected | File content shown in Monaco editor with TypeScript syntax highlighting |

### TC6-4. IDE terminal
| Field | Details |
|-------|---------|
| Action | Type `ls -la` in the xterm terminal |
| Expected | Command executes; output displayed; cwd matches selected repo |

---

## TC7. Background Customization

### TC7-1. Drag & drop background image
| Field | Details |
|-------|---------|
| Action | Drag a floor plan image onto the game canvas |
| Expected | Drop overlay appears → image set as background → `BackgroundAnalyzer` sends image to Claude SDK (with Read tool) → detects desk labels + chair circle positions → agents reposition to detected seats → positions saved to `bg-seats.json` |

### TC7-2. Background persistence
| Field | Details |
|-------|---------|
| Action | Set a background → refresh the page |
| Expected | Background image restored from IndexedDB (`bg-db.ts`); agent seats restored from `bg-seats.json` |

### TC7-3. Reset background
| Field | Details |
|-------|---------|
| Action | Click **Reset BG** button |
| Expected | Background reverts to default procedural tileset; agents return to default `seatX`/`seatY` from roster |

---

## TC8. Permission Handling

### TC8-1. Permission dialog (acceptEdits mode)
| Field | Details |
|-------|---------|
| Action | Run a task that triggers Write or Bash in `acceptEdits` permission mode |
| Expected | `permission:request` event → dialog shows tool name + description + Approve/Deny buttons |
| Verify | Approve → `canUseTool` returns `{ behavior: 'allow', updatedInput: input }` → tool executes; Deny → returns `{ behavior: 'deny', message: 'User denied the request.' }` |

### TC8-2. Permission auto-deny (30s timeout)
| Field | Details |
|-------|---------|
| Action | Let a permission dialog sit for 30 seconds |
| Expected | Auto-denied after timeout; agent receives denial and adapts |

### TC8-3. Bypass permissions mode
| Field | Details |
|-------|---------|
| Action | Set `PERMISSION_MODE=bypassPermissions` in `.env` → run a task |
| Expected | No permission dialogs; all tools execute immediately |

---

## TC9. Codebase Awareness

### TC9-1. Codebase scan on repo select
| Field | Details |
|-------|---------|
| Action | Select a new repo in RepoBar |
| Expected | Morgan shows `thinking: Analyzing project structure...` → each agent with matching files shows `thinking: {role}: N files` → Morgan returns to idle → log: "Scan complete — N agents recognized M files total" |

### TC9-2. Agent awareness in prompt
| Field | Details |
|-------|---------|
| Action | Ask Alex to work on a React component |
| Expected | Alex's system prompt includes codebase context like "Project structure (area: Frontend): src/components/ (N files)..." |
| Verify | Alex references actual project files in response |

### TC9-3. From-scratch mode
| Field | Details |
|-------|---------|
| Action | Select a repo with no frontend files → ask Alex a work task |
| Expected | Alex's prompt includes "WARNING: No existing code in this role area. Implement from scratch..." |
| Verify | During meeting discussion, from-scratch discussion lines appear (e.g., "No existing code here. Let's design from scratch.") |

---

## TC10. Meeting Flow Details

### TC10-1. Large meeting (3+ agents)
| Field | Details |
|-------|---------|
| Action | Subagent mode with 3+ team members selected |
| Expected | Agents gather at conference table position (x:747, y:280); each agent offset by 40px spread |

### TC10-2. Small meeting (1-2 agents)
| Field | Details |
|-------|---------|
| Action | Subagent mode with 2 team members selected |
| Expected | Agents gather at sofa position (x:1155, y:260) |

### TC10-3. Discussion phase content
| Field | Details |
|-------|---------|
| Action | Observe the discuss phase during any multi-agent task |
| Expected | Morgan opens: "Alright, {names} — let's review together." → up to 3 agents show randomized discussion bubbles from `DISCUSSION_POOL` (e.g., "Let's define the scope first.", "We should follow existing code patterns.") |

### TC10-4. Disperse phase
| Field | Details |
|-------|---------|
| Action | Observe the disperse phase |
| Expected | All meeting agents show "Starting work at my desk." bubble → move back to home seat positions (captured before meeting) |

---

## TC11. Agent State Machine

### TC11-1. Single work lifecycle
| Field | Details |
|-------|---------|
| Action | Run a single-agent work task and observe `agent:state` events in CC Log |
| Expected | idle → moving (to player) → communicating ("On it!") → thinking → acting (SDK work) → completed → moving (to seat) → idle |

### TC11-2. Chat lifecycle
| Field | Details |
|-------|---------|
| Action | Send a greeting and observe |
| Expected | idle → moving (to player) → communicating (response bubble) → moving (to seat) → idle |

### TC11-3. Meeting lifecycle
| Field | Details |
|-------|---------|
| Action | Run a multi-agent task and observe a participant agent |
| Expected | idle → gathering → discussing → moving (disperse to seat) → thinking → acting → completed → idle |

---

## Notes

- All agent responses are in **Korean** (by design: each agent's system prompt includes "Always respond in Korean")
- Tool output and code remain in **English**
- Brain uses `claude-sonnet-4-6` with 15-second timeout for classification
- AgentSession uses the model from `ANTHROPIC_MODEL` env var or SDK default
- Morgan's orchestration session runs with `maxTurns: 100` and all 13 other roster agents registered as SDK `AgentDefinition` sub-agents
- Wait for agents to return to their seats before running the next test case
- Use the **Cancel** button in the header to abort any in-progress task
