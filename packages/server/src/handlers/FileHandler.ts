import { resolve } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';
import { WebSocket } from 'ws';
import { toErrorMessage } from '@theater/shared';

const extMap: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', md: 'markdown', py: 'python', rs: 'rust', go: 'go',
  css: 'css', scss: 'scss', html: 'html', yaml: 'yaml', yml: 'yaml',
  sh: 'shell', bash: 'shell', zsh: 'shell', sql: 'sql',
  java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp', h: 'c',
  toml: 'toml', xml: 'xml', svg: 'xml', graphql: 'graphql',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

export function handleFileList(ws: WebSocket, dirPath: string): void {
  const resolvedDir = resolve(dirPath);
  const homeDir = process.env.HOME || '/tmp';
  if (!resolvedDir.startsWith(homeDir)) {
    ws.send(JSON.stringify({ type: 'file:list:result', payload: { dirPath, entries: [], error: 'Access denied: path outside home directory' } }));
  } else try {
    const entries = readdirSync(resolvedDir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__' && e.name !== 'dist' && e.name !== '.git')
      .map(e => {
        const fullPath = resolve(dirPath, e.name);
        return {
          name: e.name,
          path: fullPath,
          type: (e.isDirectory() ? 'directory' : 'file') as 'file' | 'directory',
          size: e.isFile() ? statSync(fullPath).size : undefined,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    ws.send(JSON.stringify({ type: 'file:list:result', payload: { dirPath, entries } }));
  } catch (err: unknown) {
    const errMsg = toErrorMessage(err);
    ws.send(JSON.stringify({ type: 'file:list:result', payload: { dirPath, entries: [], error: errMsg } }));
  }
}

export function handleFileRead(ws: WebSocket, rawFilePath: string): void {
  const filePath = resolve(rawFilePath);
  const homeDir = process.env.HOME || '/tmp';
  if (!filePath.startsWith(homeDir)) {
    ws.send(JSON.stringify({ type: 'file:read:result', payload: { filePath, content: '', language: 'plaintext', error: 'Access denied: path outside home directory' } }));
  } else {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const baseName = filePath.split('/').pop()?.toLowerCase() || '';
      const language = extMap[ext] || extMap[baseName] || 'plaintext';
      ws.send(JSON.stringify({ type: 'file:read:result', payload: { filePath, content, language } }));
    } catch (err: unknown) {
      const errMsg = toErrorMessage(err);
      ws.send(JSON.stringify({ type: 'file:read:result', payload: { filePath, content: '', language: 'plaintext', error: errMsg } }));
    }
  }
}
