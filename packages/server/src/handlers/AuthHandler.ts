import { execSync } from 'child_process';
import { appendFileSync } from 'fs';
import { resolve } from 'path';
import { WebSocket } from 'ws';
import type { ServerMessage, AuthStatusPayload } from '@theater/shared';

let claudeInstalledCache: boolean | null = null;

export function isClaudeInstalled(): boolean {
  if (claudeInstalledCache !== null) return claudeInstalledCache;
  try { execSync('claude --version', { stdio: 'ignore' }); claudeInstalledCache = true; } catch { claudeInstalledCache = false; }
  return claudeInstalledCache;
}

export function checkAuthStatus(): AuthStatusPayload {
  const claudeInstalled = isClaudeInstalled();
  if (process.env.ANTHROPIC_API_KEY) {
    return { configured: true, method: 'apikey', claudeInstalled };
  }
  return { configured: false, method: undefined, claudeInstalled };
}

export function handleSetApiKey(ws: WebSocket, apiKey: string, envDir: string): void {
  process.env.ANTHROPIC_API_KEY = apiKey;
  const envPath = resolve(envDir, '.env');
  try {
    appendFileSync(envPath, `\nANTHROPIC_API_KEY=${apiKey}\n`);
  } catch (err) { console.warn('Failed to persist API key to .env:', err); }
  ws.send(JSON.stringify({ type: 'setup:auth_status', payload: { configured: true, method: 'apikey', claudeInstalled: isClaudeInstalled() } } as ServerMessage));
}

export function handleCheckOAuth(ws: WebSocket): void {
  const claudeInstalled = isClaudeInstalled();
  ws.send(JSON.stringify({ type: 'setup:auth_status', payload: { configured: claudeInstalled, method: claudeInstalled ? 'oauth' : undefined, claudeInstalled } } as ServerMessage));
}
