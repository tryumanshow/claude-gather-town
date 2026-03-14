import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { EventBus } from '../EventBus.ts';
import { wsClient } from '../ws-client.ts';
import type { TerminalDataPayload, TerminalExitPayload } from '@theater/shared';

interface Props {
  cwd: string | null;
  terminalId: string | null;
  onTerminalId: (id: string) => void;
}

function wsSend(obj: Record<string, unknown>) {
  const ws = wsClient.getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

export function IDETerminal({ cwd, terminalId, onTerminalId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const terminalIdRef = useRef<string | null>(terminalId);
  const onTerminalIdRef = useRef(onTerminalId);
  const spawnedRef = useRef(false);

  terminalIdRef.current = terminalId;
  onTerminalIdRef.current = onTerminalId;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      },
      fontSize: 13,
      fontFamily: "'Courier New', 'Menlo', monospace",
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    termRef.current = term;

    // User input → server
    // child_process has no PTY echo, so we handle it client-side
    let lineBuffer = '';
    term.onData((data: string) => {
      const tid = terminalIdRef.current;
      if (!tid) return;

      for (const ch of data) {
        if (ch === '\r') {
          // Enter: send the line, show newline
          term.write('\r\n');
          wsSend({ type: 'terminal:input', payload: { terminalId: tid, data: lineBuffer + '\n' } });
          lineBuffer = '';
        } else if (ch === '\x7f' || ch === '\b') {
          // Backspace
          if (lineBuffer.length > 0) {
            lineBuffer = lineBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else if (ch === '\x03') {
          // Ctrl+C
          term.write('^C\r\n');
          wsSend({ type: 'terminal:input', payload: { terminalId: tid, data: '\x03' } });
          lineBuffer = '';
        } else if (ch === '\x04') {
          // Ctrl+D
          wsSend({ type: 'terminal:input', payload: { terminalId: tid, data: '\x04' } });
        } else if (ch >= ' ') {
          // Printable character: echo and buffer
          lineBuffer += ch;
          term.write(ch);
        }
      }
    });

    // Resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const tid = terminalIdRef.current;
        if (tid) {
          wsSend({ type: 'terminal:resize', payload: { terminalId: tid, cols: term.cols, rows: term.rows } });
        }
      } catch {}
    });
    resizeObserver.observe(containerRef.current);

    // Server → xterm
    const onData = (payload: TerminalDataPayload) => {
      if (!terminalIdRef.current && payload.terminalId) {
        terminalIdRef.current = payload.terminalId;
        onTerminalIdRef.current(payload.terminalId);
      }
      if (payload.terminalId === terminalIdRef.current && payload.data) {
        term.write(payload.data);
      }
    };

    const onExit = (payload: TerminalExitPayload) => {
      if (payload.terminalId === terminalIdRef.current) {
        term.write(`\r\n\x1b[90m[Process exited with code ${payload.exitCode}]\x1b[0m\r\n`);
        terminalIdRef.current = null;
        spawnedRef.current = false;
      }
    };

    EventBus.on('ws:terminal:data', onData);
    EventBus.on('ws:terminal:exit', onExit);

    // Spawn pty — retry until ws is connected
    const trySpawn = () => {
      if (spawnedRef.current) return;
      const sent = wsSend({ type: 'terminal:spawn', payload: { cwd: cwd || undefined } });
      if (sent) {
        spawnedRef.current = true;
      }
    };

    trySpawn();

    // If ws wasn't ready, retry on connect
    const onConnected = () => { trySpawn(); };
    EventBus.on('ws:connected', onConnected);

    // Also retry with a short delay (ws might be connected but getSocket timing issue)
    const retryTimer = setTimeout(trySpawn, 500);

    return () => {
      clearTimeout(retryTimer);
      resizeObserver.disconnect();
      EventBus.off('ws:terminal:data', onData);
      EventBus.off('ws:terminal:exit', onExit);
      EventBus.off('ws:connected', onConnected);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        padding: '4px',
        boxSizing: 'border-box',
      }}
    />
  );
}
