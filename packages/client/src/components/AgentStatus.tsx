import React, { useState, useEffect, useMemo } from 'react';
import { useDraggableResize } from '../hooks/useDraggableResize.ts';
import { EventBus } from '../EventBus.ts';
import { isRosterId } from '@theater/shared';
import type { AgentSpawnPayload, AgentStatePayload, AgentDespawnPayload, WorldSnapshotPayload, RosterInitPayload } from '@theater/shared';

interface AgentInfo {
  id: string;
  displayName: string;
  type: string;
  color: string;
  state: string;
  role?: string;
  isRoster?: boolean;
}

interface Props {
  overlay?: boolean;
}

const STATE_CONFIG: Record<string, { color: string; icon: string }> = {
  idle: { color: '#b0b8c0', icon: '💤' },
  thinking: { color: '#f39c12', icon: '🤔' },
  acting: { color: '#e94560', icon: '⚡' },
  coding: { color: '#4a90d9', icon: '💻' },
  reviewing: { color: '#e67e22', icon: '🔍' },
  completed: { color: '#2ecc71', icon: '✅' },
  spawning: { color: '#9b59b6', icon: '✨' },
  moving: { color: '#3498db', icon: '🚶' },
  communicating: { color: '#e91e63', icon: '💬' },
  failed: { color: '#e74c3c', icon: '❌' },
  despawning: { color: '#7f8c8d', icon: '👋' },
  gathering: { color: '#9b59b6', icon: '📍' },
  discussing: { color: '#e91e63', icon: '💬' },
};

export function AgentStatus({ overlay = false }: Props) {
  const [agents, setAgents] = useState<Map<string, AgentInfo>>(new Map());
  const [rosterAgents, setRosterAgents] = useState<Map<string, AgentInfo>>(new Map());
  const [collapsed, setCollapsed] = useState(true);
  const {
    size: overlayMaxHeight,
    onMouseDown: handleOverlayResizeMouseDown,
    isDraggingRef: isDraggingOverlayRef,
  } = useDraggableResize({ direction: 'vertical', min: 80, max: 700, initial: 360, invert: true });

  useEffect(() => {
    const onRosterInit = (payload: RosterInitPayload) => {
      const roster = new Map<string, AgentInfo>();
      for (const ra of payload.agents) {
        roster.set(ra.id, {
          id: ra.id,
          displayName: ra.name,
          type: ra.agentType,
          color: ra.color,
          state: ra.state,
          role: ra.role,
          isRoster: true,
        });
      }
      setRosterAgents(roster);
    };

    const onSpawn = (payload: AgentSpawnPayload) => {
      if (isRosterId(payload.agentId)) return;
      setAgents(prev => {
        const next = new Map(prev);
        next.set(payload.agentId, {
          id: payload.agentId,
          displayName: payload.displayName,
          type: payload.agentType,
          color: payload.color,
          state: 'spawning',
        });
        return next;
      });
    };

    const onState = (payload: AgentStatePayload) => {
      setRosterAgents(prev => {
        if (!prev.has(payload.agentId)) return prev;
        const next = new Map(prev);
        const agent = next.get(payload.agentId)!;
        next.set(payload.agentId, { ...agent, state: payload.state });
        return next;
      });
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(payload.agentId);
        if (agent) {
          next.set(payload.agentId, { ...agent, state: payload.state });
        }
        return next;
      });
    };

    const onDespawn = (payload: AgentDespawnPayload) => {
      if (isRosterId(payload.agentId)) return;
      setAgents(prev => {
        const next = new Map(prev);
        next.delete(payload.agentId);
        return next;
      });
    };

    const onSnapshot = (payload: WorldSnapshotPayload) => {
      const newAgents = new Map<string, AgentInfo>();
      for (const a of payload.agents) {
        if (isRosterId(a.id)) {
          setRosterAgents(prev => {
            const next = new Map(prev);
            if (next.has(a.id)) {
              const existing = next.get(a.id)!;
              next.set(a.id, { ...existing, state: a.state });
            }
            return next;
          });
          continue;
        }
        newAgents.set(a.id, {
          id: a.id,
          displayName: a.displayName,
          type: a.type,
          color: a.color,
          state: a.state,
        });
      }
      setAgents(newAgents);
    };

    EventBus.on('ws:roster:init', onRosterInit);
    EventBus.on('ws:agent:spawn', onSpawn);
    EventBus.on('ws:agent:state', onState);
    EventBus.on('ws:agent:despawn', onDespawn);
    EventBus.on('ws:world:snapshot', onSnapshot);

    return () => {
      EventBus.off('ws:roster:init', onRosterInit);
      EventBus.off('ws:agent:spawn', onSpawn);
      EventBus.off('ws:agent:state', onState);
      EventBus.off('ws:agent:despawn', onDespawn);
      EventBus.off('ws:world:snapshot', onSnapshot);
    };
  }, []);

  const rosterList = useMemo(() => Array.from(rosterAgents.values()), [rosterAgents]);
  const agentList = useMemo(() => Array.from(agents.values()).filter(a => !isRosterId(a.id) && a.id !== 'team-lead'), [agents]);

  const totalCount = rosterList.length + agentList.length;

  // Overlay mode: positioned at bottom-left of game canvas
  if (overlay) {
    return (
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 40,
        background: 'rgba(13, 27, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '10px',
        border: '1px solid #2a2a5e',
        maxWidth: '420px',
        maxHeight: collapsed ? '36px' : `${overlayMaxHeight}px`,
        overflow: 'hidden',
        transition: collapsed ? 'max-height 0.3s ease' : undefined,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Resize handle at top edge (only when expanded) */}
        {!collapsed && (
          <div
            onMouseDown={handleOverlayResizeMouseDown}
            style={{
              height: '5px',
              cursor: 'row-resize',
              background: 'transparent',
              flexShrink: 0,
              borderRadius: '10px 10px 0 0',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.4)'; }}
            onMouseLeave={e => {
              if (!isDraggingOverlayRef.current) e.currentTarget.style.background = 'transparent';
            }}
          />
        )}
        {/* Collapse toggle header */}
        <div
          onClick={() => setCollapsed(v => !v)}
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            borderBottom: collapsed ? 'none' : '1px solid #1a1a4e',
          }}
        >
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#8899aa',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Agents
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              background: '#4A90D9',
              color: '#fff',
              borderRadius: '10px',
              padding: '1px 8px',
              fontSize: '10px',
              fontWeight: 700,
            }}>{totalCount}</span>
            <span style={{ color: '#555', fontSize: '10px' }}>{collapsed ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Agent list */}
        {!collapsed && (
          <div style={{ padding: '4px 8px 8px', overflow: 'auto', maxHeight: '256px' }}>
            {/* Team Roster */}
            {rosterList.map(agent => {
              const cfg = STATE_CONFIG[agent.state] ?? STATE_CONFIG.idle;
              const isActive = agent.state !== 'idle';
              return (
                <div key={agent.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 6px',
                  fontSize: '11px',
                  background: isActive ? 'rgba(74,144,217,0.08)' : 'transparent',
                  borderRadius: '4px',
                  marginBottom: '2px',
                  opacity: isActive ? 1 : 0.65,
                  transition: 'opacity 0.3s, background 0.3s',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: agent.color, flexShrink: 0,
                    boxShadow: isActive ? `0 0 6px ${agent.color}` : 'none',
                  }} />
                  <span style={{ flex: 1, fontWeight: 500, fontSize: '11px', display: 'flex', alignItems: 'baseline', gap: '4px', overflow: 'hidden' }}>
                    <span style={{ color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.displayName}</span>
                    {agent.role && <span style={{ color: '#666', fontSize: '9px', whiteSpace: 'nowrap', flexShrink: 0 }}>({agent.role})</span>}
                  </span>
                  <span style={{ fontSize: '10px', flexShrink: 0 }}>{cfg.icon}</span>
                  <span style={{
                    fontSize: '9px', color: cfg.color, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                    animation: agent.state === 'thinking' || agent.state === 'acting'
                      ? 'pulse 1.5s ease-in-out infinite' : undefined,
                  }}>
                    {agent.state}
                  </span>
                </div>
              );
            })}

            {/* Dynamic Agents */}
            {agentList.length > 0 && (
              <>
                {rosterList.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(42,42,94,0.3)', margin: '4px 0' }} />
                )}
                {agentList.map((agent) => {
                  const cfg = STATE_CONFIG[agent.state] ?? STATE_CONFIG.idle;
                  return (
                    <div key={agent.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 6px',
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '4px',
                      marginBottom: '2px',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: agent.color, flexShrink: 0,
                        boxShadow: `0 0 4px ${agent.color}44`,
                      }} />
                      <span style={{ color: '#ccc', flex: 1, fontWeight: 500, fontSize: '11px' }}>
                        {agent.displayName}
                      </span>
                      <span style={{ fontSize: '10px', flexShrink: 0 }}>{cfg.icon}</span>
                      <span style={{
                        fontSize: '9px', color: cfg.color, fontWeight: 600,
                        textTransform: 'uppercase',
                        animation: agent.state === 'thinking' || agent.state === 'acting'
                          ? 'pulse 1.5s ease-in-out infinite' : undefined,
                      }}>
                        {agent.state}
                      </span>
                    </div>
                  );
                })}
              </>
            )}

            {totalCount === 0 && (
              <div style={{ color: '#555', fontSize: '10px', textAlign: 'center', padding: '8px 4px' }}>
                No active agents
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Non-overlay mode (legacy panel usage)
  return (
    <div style={{ padding: '12px 14px', maxHeight: '320px', overflow: 'auto' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#666',
        textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Team Roster</span>
        <span style={{
          background: '#4A90D9', color: '#fff', borderRadius: '10px',
          padding: '1px 8px', fontSize: '10px', fontWeight: 700,
        }}>{rosterList.length}</span>
      </div>
      {rosterList.map((agent) => {
        const cfg = STATE_CONFIG[agent.state] ?? STATE_CONFIG.idle;
        const isActive = agent.state !== 'idle';
        return (
          <div key={agent.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 8px', fontSize: '12px',
            background: isActive ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.02)',
            borderRadius: '6px', marginBottom: '3px',
            opacity: isActive ? 1 : 0.6,
            transition: 'opacity 0.3s, background 0.3s',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: agent.color, flexShrink: 0,
              boxShadow: isActive ? `0 0 8px ${agent.color}` : `0 0 4px ${agent.color}44`,
            }} />
            <span style={{ color: '#ddd', flex: 1, fontWeight: 500, fontSize: '12px' }}>{agent.displayName}</span>
            <span style={{ fontSize: '9px', color: '#888', flexShrink: 0 }}>{agent.role}</span>
            <span style={{ fontSize: '12px', flexShrink: 0 }}>{cfg.icon}</span>
            <span style={{
              fontSize: '10px', color: cfg.color, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.5px', minWidth: '45px', textAlign: 'right',
              animation: agent.state === 'thinking' || agent.state === 'acting'
                ? 'pulse 1.5s ease-in-out infinite' : undefined,
            }}>{agent.state}</span>
          </div>
        );
      })}

      {agentList.length > 0 && (
        <>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#666',
            textTransform: 'uppercase', letterSpacing: '1.2px',
            marginTop: '12px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Active Agents</span>
            <span style={{
              background: '#e94560', color: '#fff', borderRadius: '10px',
              padding: '1px 8px', fontSize: '10px', fontWeight: 700,
            }}>{agentList.length}</span>
          </div>
          {agentList.map((agent, i) => {
            const cfg = STATE_CONFIG[agent.state] ?? STATE_CONFIG.idle;
            return (
              <div key={agent.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '6px 8px', fontSize: '12px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px',
                animation: `slideIn 0.3s ease ${i * 0.05}s both`,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: agent.color, flexShrink: 0,
                  boxShadow: `0 0 6px ${agent.color}44`,
                }} />
                <span style={{ color: '#ddd', flex: 1, fontWeight: 500, fontSize: '12px' }}>{agent.displayName}</span>
                <span style={{ fontSize: '12px', flexShrink: 0 }}>{cfg.icon}</span>
                <span style={{
                  fontSize: '10px', color: cfg.color, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  animation: agent.state === 'thinking' || agent.state === 'acting'
                    ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}>{agent.state}</span>
              </div>
            );
          })}
        </>
      )}

      {rosterList.length === 0 && agentList.length === 0 && (
        <div style={{ color: '#777', fontSize: '12px', textAlign: 'center', padding: '16px 8px' }}>
          No active agents
          <div style={{ fontSize: '10px', color: '#666', marginTop: '6px', lineHeight: '1.6' }}>
            Try saying <span style={{ color: '#2ecc71' }}>hi</span> to chat,
            or click a preset below to start
          </div>
        </div>
      )}
    </div>
  );
}
