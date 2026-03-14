import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EventBus } from '../EventBus.ts';
import { wsClient } from '../ws-client.ts';
import { AGENT_ROSTER } from '@theater/shared';
import type { AgentTextPayload, ToolUsePayload, AgentStatePayload, LogEventPayload } from '@theater/shared';

export interface CCLogEntry {
  id: number;
  timestamp: number;
  type: 'assistant' | 'tool_use' | 'tool_result' | 'state' | 'system';
  agentId: string;
  agentName?: string;
  agentColor?: string;
  text: string;
}

const rosterMap = new Map(
  AGENT_ROSTER.map(ra => [`roster-${ra.id}`, { name: ra.name, color: ra.color }])
);

function getAgentInfo(agentId: string): { name: string; color: string } {
  const roster = rosterMap.get(agentId);
  if (roster) return roster;
  if (agentId.startsWith('sub-')) return { name: agentId.replace('sub-', ''), color: '#e94560' };
  return { name: agentId, color: '#4A90D9' };
}

let entryIdCounter = 0;

export function CCLogPanel() {
  const [entries, setEntries] = useState<CCLogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleNewSession = useCallback(() => {
    setEntries([]);
    wsClient.send({ type: 'control', payload: { action: 'reset' } });
  }, []);

  useEffect(() => {
    const addEntry = (entry: Omit<CCLogEntry, 'id' | 'timestamp'>) => {
      setEntries(prev => {
        const next = [...prev, { ...entry, id: ++entryIdCounter, timestamp: Date.now() }];
        return next.length > 500 ? next.slice(-500) : next;
      });
    };

    const onAgentText = (payload: AgentTextPayload) => {
      const info = getAgentInfo(payload.agentId);
      const isToolResult = payload.role === 'tool_result';
      addEntry({
        type: isToolResult ? (payload.text.startsWith('> Tool:') ? 'tool_use' : 'tool_result') : 'assistant',
        agentId: payload.agentId,
        agentName: info.name,
        agentColor: info.color,
        text: payload.text,
      });
    };

    const onAgentTool = (payload: ToolUsePayload) => {
      const info = getAgentInfo(payload.agentId);
      addEntry({
        type: 'tool_use',
        agentId: payload.agentId,
        agentName: info.name,
        agentColor: info.color,
        text: `> ${payload.tool}: ${payload.description}`,
      });
    };

    const onAgentState = (payload: AgentStatePayload) => {
      const info = getAgentInfo(payload.agentId);
      addEntry({
        type: 'state',
        agentId: payload.agentId,
        agentName: info.name,
        agentColor: info.color,
        text: `[${payload.state}]${payload.detail ? ' ' + payload.detail : ''}`,
      });
    };

    const onSimLog = (payload: LogEventPayload) => {
      addEntry({
        type: 'system',
        agentId: payload.agentId || 'system',
        agentName: payload.agentName || payload.source,
        agentColor: payload.agentColor || '#5a5a7e',
        text: `[${payload.level.toUpperCase()}] ${payload.source}: ${payload.message}`,
      });
    };

    EventBus.on('ws:agent:text', onAgentText);
    EventBus.on('ws:agent:tool', onAgentTool);
    EventBus.on('ws:agent:state', onAgentState);
    EventBus.on('ws:sim:log', onSimLog);

    return () => {
      EventBus.off('ws:agent:text', onAgentText);
      EventBus.off('ws:agent:tool', onAgentTool);
      EventBus.off('ws:agent:state', onAgentState);
      EventBus.off('ws:sim:log', onSimLog);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const getEntryStyle = (entry: CCLogEntry): { color: string; borderColor: string; bg: string } => {
    switch (entry.type) {
      case 'assistant':
        return { color: '#e0e0e0', borderColor: entry.agentColor || '#4A90D9', bg: 'transparent' };
      case 'tool_use':
        return { color: '#00e5ff', borderColor: '#00e5ff33', bg: 'rgba(0,229,255,0.03)' };
      case 'tool_result':
        return { color: '#888', borderColor: '#33333380', bg: 'rgba(255,255,255,0.01)' };
      case 'state':
        return { color: '#f39c12', borderColor: '#f39c1233', bg: 'transparent' };
      case 'system':
        return { color: '#7f8c8d', borderColor: '#7f8c8d33', bg: 'transparent' };
      default:
        return { color: '#aaa', borderColor: 'transparent', bg: 'transparent' };
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1a1a1a',
        background: '#111',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#2ecc71',
            display: 'inline-block',
            animation: 'pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#2ecc71',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            fontFamily: "'Courier New', monospace",
          }}>
            CC Execution Log
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px',
            color: '#555',
            fontFamily: "'Courier New', monospace",
          }}>
            {entries.length} entries
          </span>
          <button
            onClick={handleNewSession}
            title="Clear log and reset session"
            style={{
              background: 'rgba(233,69,96,0.15)',
              border: '1px solid #e9456040',
              borderRadius: '5px',
              color: '#e94560',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(233,69,96,0.3)';
              (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(233,69,96,0.15)';
              (e.currentTarget as HTMLElement).style.borderColor = '#e9456040';
            }}
          >
            🔄 New Session
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 0',
          fontFamily: "'Courier New', 'Fira Code', monospace",
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {entries.map(entry => {
          const style = getEntryStyle(entry);
          return (
            <div key={entry.id} style={{
              padding: '3px 12px 3px 8px',
              borderLeft: `3px solid ${style.borderColor}`,
              background: style.bg,
              marginBottom: '1px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}>
              {/* Timestamp */}
              <span style={{
                color: '#3a3a3a',
                fontSize: '12px',
                flexShrink: 0,
                minWidth: '65px',
                paddingTop: '2px',
              }}>
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>

              {/* Agent badge */}
              {entry.type !== 'system' && entry.agentName && (
                <span style={{
                  flexShrink: 0,
                  background: entry.agentColor || '#444',
                  color: '#fff',
                  borderRadius: '3px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 700,
                  lineHeight: '18px',
                  maxWidth: '90px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.agentName}
                </span>
              )}

              {/* State label */}
              {entry.type === 'state' && (
                <span style={{
                  flexShrink: 0,
                  background: 'rgba(243,156,18,0.15)',
                  color: '#f39c12',
                  borderRadius: '3px',
                  padding: '0px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  lineHeight: '18px',
                }}>
                  STATE
                </span>
              )}

              {/* Text */}
              <span style={{
                color: style.color,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                flex: 1,
                paddingLeft: entry.type === 'tool_result' ? '16px' : '0',
              }}>
                {entry.text}
              </span>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div style={{
            color: '#333',
            textAlign: 'center',
            padding: '40px 20px',
            fontFamily: "'Courier New', monospace",
            fontSize: '13px',
          }}>
            <div style={{ color: '#2ecc71', marginBottom: '8px' }}>$ awaiting input...</div>
            <div style={{ fontSize: '11px', color: '#2a2a2a' }}>
              Claude Code execution logs will appear here
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
