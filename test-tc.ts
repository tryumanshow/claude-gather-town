/**
 * TC runner — connects to the server via WebSocket and sends test commands.
 * Captures server events to verify Brain classification and agent routing.
 *
 * Usage: npx tsx test-tc.ts
 * (server must be running: npm run dev:server)
 */
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001';

interface ServerEvent {
  type: string;
  payload: any;
}

function runTC(label: string, raw: string, mode?: string): Promise<ServerEvent[]> {
  return new Promise((resolve, reject) => {
    const events: ServerEvent[] = [];
    const ws = new WebSocket(WS_URL);
    let settled = false;
    let idleTimer: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      ws.close();
      resolve(events);
    };

    // Auto-finish after 4s of no events (Brain+chat should be fast)
    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, 4000);
    };

    ws.on('open', () => {
      // Wait for initial messages (roster:init, repo:status, etc.)
      setTimeout(() => {
        // First select repo
        ws.send(JSON.stringify({
          type: 'repo:select',
          payload: { path: process.cwd(), action: 'select' },
        }));

        setTimeout(() => {
          // Send the test command
          const payload: any = { raw, playerX: 640, playerY: 640 };
          if (mode) payload.mode = mode;
          ws.send(JSON.stringify({ type: 'command', payload }));
          resetTimer();
        }, 1000);
      }, 500);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerEvent;
        // Only collect relevant events (skip initial roster/repo/snapshot)
        if (['agent:state', 'agent:move', 'agent:chat', 'task:event', 'sim:log', 'agent:tool', 'agent:text', 'meeting:phase'].includes(msg.type)) {
          events.push(msg);
          resetTimer();
        }
      } catch {}
    });

    ws.on('error', (err) => {
      if (!settled) { settled = true; reject(err); }
    });

    // Hard timeout
    setTimeout(() => {
      if (!settled) {
        console.log(`  [TIMEOUT] ${label} — stopping after 30s`);
        finish();
      }
    }, 30000);
  });
}

function summarize(label: string, events: ServerEvent[]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`TC: ${label}`);
  console.log(`${'─'.repeat(60)}`);

  // Brain log
  const brainLogs = events.filter(e =>
    e.type === 'sim:log' && e.payload?.source === 'Brain'
  );
  for (const log of brainLogs) {
    console.log(`  🧠 Brain: ${log.payload.message}`);
  }

  // Agent selected
  const stateEvents = events.filter(e => e.type === 'agent:state');
  const firstState = stateEvents[0];
  if (firstState) {
    console.log(`  👤 Agent: ${firstState.payload.agentId} → ${firstState.payload.state}`);
  }

  // Chat bubbles
  const chats = events.filter(e => e.type === 'agent:chat');
  for (const c of chats) {
    console.log(`  💬 ${c.payload.agentId}: "${c.payload.text.slice(0, 80)}${c.payload.text.length > 80 ? '...' : ''}"`);
  }

  // Tool usage
  const tools = events.filter(e => e.type === 'agent:tool');
  if (tools.length > 0) {
    console.log(`  🔧 Tools used: ${tools.map(t => t.payload.tool).join(', ')}`);
  }

  // Tasks
  const tasks = events.filter(e => e.type === 'task:event');
  if (tasks.length > 0) {
    console.log(`  📋 TaskBoard: ${tasks.map(t => `${t.payload.action}(${t.payload.task.status})`).join(' → ')}`);
  }

  // Meeting
  const meetings = events.filter(e => e.type === 'meeting:phase');
  if (meetings.length > 0) {
    console.log(`  🤝 Meeting: ${meetings.map(m => m.payload.phase).join(' → ')}`);
  }

  // Agent text (SDK streaming)
  const texts = events.filter(e => e.type === 'agent:text');
  if (texts.length > 0) {
    const combined = texts.map(t => t.payload.text).join('');
    console.log(`  📝 Text: "${combined.slice(0, 120)}${combined.length > 120 ? '...' : ''}"`);
  }

  // Movement
  const moves = events.filter(e => e.type === 'agent:move');
  if (moves.length > 0) {
    console.log(`  🚶 Moves: ${moves.length}x`);
  }

  const hasTools = tools.length > 0;
  const hasTask = tasks.length > 0;
  console.log(`  ✅ SDK used: ${hasTools ? 'YES' : 'NO'} | TaskBoard: ${hasTask ? 'YES' : 'NO'}`);
}

async function main() {
  console.log('Claude Gather.town — TC Runner');
  console.log('Connecting to', WS_URL, '...\n');

  // TC1-1: Chat intent
  try {
    const e1 = await runTC('TC1-1: 인사 (chat)', '안녕!');
    summarize('TC1-1: 인사 → chat 의도, SDK 미사용', e1);
  } catch (err) {
    console.error('TC1-1 failed:', err);
  }

  // TC1-3: Named agent + chat
  try {
    const e3 = await runTC('TC1-3: Alex 호명', 'Alex 안녕!');
    summarize('TC1-3: Alex 호명 → Alex가 응답', e3);
  } catch (err) {
    console.error('TC1-3 failed:', err);
  }

  // TC1-4: Work intent
  try {
    const e4 = await runTC('TC1-4: 작업 요청 (work)', 'package.json에 있는 dependencies 목록 알려줘');
    summarize('TC1-4: 작업 요청 → work 의도, SDK 사용', e4);
  } catch (err) {
    console.error('TC1-4 failed:', err);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Done. Subagent/Teams TCs require longer runtime — test manually.');
}

main().catch(console.error);
