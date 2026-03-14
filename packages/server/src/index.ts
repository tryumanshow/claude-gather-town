import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from project root (../../.env relative to packages/server/src/)
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../.env'), override: false }); // fallback to packages/server/.env
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SimulationEngine } from './SimulationEngine.js';
import { CommandParser } from './CommandParser.js';
import { RepoManager } from './RepoManager.js';
import { BackgroundAnalyzer } from './BackgroundAnalyzer.js';
import type { ClientMessage, ServerMessage, AgentPermissionPayload } from '@theater/shared';

// Handlers
import { checkAuthStatus, handleSetApiKey, handleCheckOAuth } from './handlers/AuthHandler.js';
import { handleTerminalSpawn, handleTerminalInput, handleTerminalKill, cleanupTerminals } from './handlers/TerminalManager.js';
import { handleFileList, handleFileRead } from './handlers/FileHandler.js';
import { applySavedSeatsToWorld, sendSavedSeats, handleBgAnalyze } from './handlers/SeatManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// POST /api/hello - Hello World demo endpoint
app.post('/api/hello', (req, res) => {
  const { message } = req.body as { message: string };
  const lower = (message || '').toLowerCase().trim();

  if (lower.includes('hello world')) {
    res.json({
      success: true,
      reply: `Hello! Backend server (port 3001) responded!`,
      echo: message,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      success: false,
      reply: `Try typing "hello world~"!`,
      echo: message,
      timestamp: new Date().toISOString()
    });
  }
});

const simulation = new SimulationEngine();
const parser = new CommandParser();
const repoManager = new RepoManager();
const bgAnalyzer = new BackgroundAnalyzer();

// Configure real execution engine
{
  const workingDirectory = process.env.WORKING_DIRECTORY || null;
  const model = process.env.ANTHROPIC_MODEL || undefined;
  const permissionMode = process.env.PERMISSION_MODE === 'bypass' ? 'bypassPermissions' as const : 'acceptEdits' as const;

  const initialWorkDir = workingDirectory || resolve(process.env.HOME || process.env.USERPROFILE || '~');
  simulation.setRealEngine({ workingDirectory: initialWorkDir, model, permissionMode });

  // Always set a working directory so buttons are enabled on first load
  repoManager.setWorkingDirectory(initialWorkDir);

  console.log(`Real execution engine configured (model: ${model || 'default'}, workDir: ${initialWorkDir}, permissions: ${permissionMode})`);
  console.log('Tip: Ensure Claude Code CLI is logged in (claude auth login) for /real mode to work.');
}

// Ensure roster agents exist on startup (Morgan acts as team lead)
simulation.world.ensureRoster();

// Apply saved seat positions at startup
applySavedSeatsToWorld(simulation);

// Track connected clients
const clients = new Set<WebSocket>();

// Pending permission requests: permissionId → resolve function
const pendingPermissions = new Map<string, (approved: boolean) => void>();

const makePermissionHandler = (ws: WebSocket) =>
  async (req: AgentPermissionPayload): Promise<boolean> => {
    // Log to CCLogPanel
    ws.send(JSON.stringify({
      type: 'sim:log',
      payload: {
        timestamp: Date.now(),
        level: 'warn',
        source: req.agentId,
        message: `Permission request: ${req.description}`,
        agentId: req.agentId,
      },
    } as ServerMessage));
    // Send dialog event
    ws.send(JSON.stringify({ type: 'agent:permission', payload: req } as ServerMessage));
    // Wait for user response (30s timeout → auto-deny)
    return new Promise<boolean>((resolve) => {
      pendingPermissions.set(req.permissionId, resolve);
      setTimeout(() => {
        if (pendingPermissions.delete(req.permissionId)) resolve(false);
      }, 30000);
    });
  };

// Broadcast to all clients
function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Wire simulation events to WebSocket broadcast
simulation.on('event', (event: ServerMessage) => {
  broadcast(event);
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  // Send auth status first so client can show setup screen if needed
  ws.send(JSON.stringify({ type: 'setup:auth_status', payload: checkAuthStatus() } as ServerMessage));

  // Send current state snapshot + roster init
  ws.send(JSON.stringify(simulation.getSnapshot()));
  ws.send(JSON.stringify(simulation.getRosterInit()));

  // Send saved seat positions to newly connected client
  sendSavedSeats(ws);

  // Send current repo status
  const repoStatus: ServerMessage = { type: 'repo:status', payload: repoManager.getStatus() };
  ws.send(JSON.stringify(repoStatus));

  // Set permission handler once per connection, not per message
  simulation.setPermissionHandler(makePermissionHandler(ws));

  ws.on('message', (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      if (msg.type === 'setup:set_apikey') {
        handleSetApiKey(ws, msg.payload.apiKey, resolve(__dirname, '../../..'));
        return;
      } else if (msg.type === 'setup:check_oauth') {
        handleCheckOAuth(ws);
        return;
      } else if (msg.type === 'player:permission_answer') {
        const { permissionId, approved } = msg.payload;
        const resolver = pendingPermissions.get(permissionId);
        if (resolver) {
          pendingPermissions.delete(permissionId);
          resolver(approved);
        }
      } else if (msg.type === 'command') {
        if (msg.payload.playerX != null && msg.payload.playerY != null) {
          simulation.setPlayerPos(msg.payload.playerX, msg.payload.playerY);
        }
        const parsed = parser.parse(msg.payload.raw);
        if (parsed) {
          if (msg.payload.mode) {
            parsed.mode = msg.payload.mode;
          }
          simulation.execute(parsed);
        } else {
          broadcast({
            type: 'sim:log',
            payload: {
              timestamp: Date.now(),
              level: 'error',
              source: 'CommandParser',
              message: `Unknown command: ${msg.payload.raw}`,
            },
          });
        }
      } else if (msg.type === 'control') {
        const { action, value } = msg.payload;
        switch (action) {
          case 'reset': simulation.reset(); break;
          case 'speed': if (value) simulation.setSpeed(value); break;
        }
      } else if (msg.type === 'repo:select') {
        const { path, action } = msg.payload;
        if (action === 'scratch') {
          repoManager.setScratch();
          broadcast({ type: 'repo:status', payload: repoManager.getStatus() });
        } else {
          const result = repoManager.setWorkingDirectory(path);
          if (result.valid) {
            simulation.updateRealEngineWorkingDirectory(path);
            broadcast({ type: 'repo:status', payload: repoManager.getStatus() });
            simulation.triggerCodebaseScan();
          } else {
            broadcast({
              type: 'sim:log',
              payload: {
                timestamp: Date.now(),
                level: 'error',
                source: 'RepoManager',
                message: result.error || 'Invalid path',
              },
            });
          }
        }
      } else if (msg.type === 'bg:analyze') {
        handleBgAnalyze(broadcast, simulation, bgAnalyzer, __dirname, msg.payload);
      } else if (msg.type === 'file:list') {
        handleFileList(ws, msg.payload.dirPath);
      } else if (msg.type === 'file:read') {
        handleFileRead(ws, msg.payload.filePath);
      } else if (msg.type === 'terminal:spawn') {
        handleTerminalSpawn(ws, msg.payload.cwd, repoManager);
      } else if (msg.type === 'terminal:input') {
        handleTerminalInput(msg.payload.terminalId, msg.payload.data);
      } else if (msg.type === 'terminal:resize') {
        // child_process doesn't support resize — ignored
      } else if (msg.type === 'terminal:kill') {
        handleTerminalKill(msg.payload.terminalId);
      }
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    cleanupTerminals();
    console.log(`Client disconnected (${clients.size} total)`);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Claude Gather.town server running on http://localhost:${PORT}`);
});
