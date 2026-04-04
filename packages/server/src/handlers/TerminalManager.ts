import { spawn, type ChildProcess } from 'child_process';
import { WebSocket } from 'ws';
import type { RepoManager } from '../RepoManager.js';
import { toErrorMessage } from '@theater/shared';

const activeTerminals = new Map<string, ChildProcess>();
let terminalCounter = 0;

export function handleTerminalSpawn(ws: WebSocket, cwd: string | undefined, repoManager: RepoManager): void {
  const resolvedCwd = cwd || repoManager.getStatus().path || process.env.HOME || '/tmp';
  const id = `term-${++terminalCounter}`;
  try {
    const proc = spawn('/bin/bash', ['--norc', '-i'], {
      cwd: resolvedCwd,
      env: { ...process.env, TERM: 'dumb', PS1: '\\[\\e[36m\\]\\w\\[\\e[0m\\] $ ' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    activeTerminals.set(id, proc);
    const sendData = (raw: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        const data = raw.replace(/\r?\n/g, '\r\n');
        ws.send(JSON.stringify({ type: 'terminal:data', payload: { terminalId: id, data } }));
      }
    };
    proc.stdout?.on('data', (chunk: Buffer) => sendData(chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => sendData(chunk.toString()));
    proc.on('exit', (code) => {
      activeTerminals.delete(id);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal:exit', payload: { terminalId: id, exitCode: code ?? 0 } }));
      }
    });
    proc.on('error', (err) => {
      console.error(`[Terminal ${id}] error:`, err.message);
      activeTerminals.delete(id);
    });
    ws.send(JSON.stringify({ type: 'terminal:data', payload: { terminalId: id, data: '' } }));
    console.log(`[Terminal ${id}] spawned: bash -i in ${resolvedCwd}`);
  } catch (err: unknown) {
    const errMsg = toErrorMessage(err);
    console.error(`[Terminal] spawn failed:`, errMsg);
    ws.send(JSON.stringify({ type: 'terminal:exit', payload: { terminalId: id, exitCode: 1 } }));
  }
}

export function handleTerminalInput(terminalId: string, data: string): void {
  const proc = activeTerminals.get(terminalId);
  if (proc?.stdin?.writable) proc.stdin.write(data);
}

export function handleTerminalKill(terminalId: string): void {
  const proc = activeTerminals.get(terminalId);
  if (proc) { proc.kill(); activeTerminals.delete(terminalId); }
}

export function cleanupTerminals(): void {
  for (const [id, proc] of activeTerminals) {
    try { proc.kill(); } catch {}
    activeTerminals.delete(id);
  }
}
