import React from 'react';
import { wsClient } from '../ws-client.ts';
import type { SimStatusPayload } from '@theater/shared';

interface HeaderBarProps {
  viewMode: 'gather' | 'ide';
  setViewMode: (mode: 'gather' | 'ide') => void;
  simStatus: SimStatusPayload | null;
  connected: boolean;
  hasBgImage: boolean;
  onResetBg: () => void;
  onResetAuth: () => void;
}

export function HeaderBar({ viewMode, setViewMode, simStatus, connected, hasBgImage, onResetBg }: HeaderBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      background: 'linear-gradient(135deg, #16213e 0%, #1a1a3e 100%)',
      borderBottom: '1px solid #2a2a5e',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'border-bottom 0.3s ease, box-shadow 0.3s ease',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>🎭</span>
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#e94560', letterSpacing: '-0.3px', margin: 0 }}>
          Claude Gather.town
        </h1>

        {/* View mode toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px',
          border: '1px solid #2a2a5e',
          overflow: 'hidden',
          marginLeft: '8px',
        }}>
          <button
            onClick={() => setViewMode('gather')}
            style={{
              background: viewMode === 'gather' ? '#e94560' : 'transparent',
              border: 'none',
              color: viewMode === 'gather' ? '#fff' : '#666',
              padding: '3px 10px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🏢 Office
          </button>
          <button
            onClick={() => setViewMode('ide')}
            style={{
              background: viewMode === 'ide' ? '#007acc' : 'transparent',
              border: 'none',
              borderLeft: '1px solid #2a2a5e',
              color: viewMode === 'ide' ? '#fff' : '#666',
              padding: '3px 10px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            💻 IDE
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
        {simStatus && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#666', fontSize: '11px' }}>MODE</span>
              <span style={{
                color: '#e94560', fontWeight: 600, fontSize: '11px',
                background: 'rgba(233,69,96,0.15)', padding: '2px 8px', borderRadius: '4px',
              }}>{simStatus.mode || 'idle'}</span>
            </div>

            {/* Speed controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#666', fontSize: '11px', marginRight: '3px' }}>SPEED</span>
              {[0.5, 1, 2, 3].map(s => (
                <button
                  key={s}
                  onClick={() => wsClient.send({ type: 'control', payload: { action: 'speed', value: s } })}
                  style={{
                    background: simStatus.speed === s ? '#e94560' : 'rgba(255,255,255,0.05)',
                    border: simStatus.speed === s ? '1px solid #e94560' : '1px solid #2a2a5e',
                    borderRadius: '4px',
                    color: simStatus.speed === s ? '#fff' : '#888',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Cancel */}
            <button
              onClick={() => wsClient.send({ type: 'control', payload: { action: 'reset' } })}
              style={{
                background: 'rgba(231,76,60,0.2)',
                border: '1px solid #e74c3c60',
                borderRadius: '4px',
                color: '#e74c3c',
                padding: '2px 10px',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#666', fontSize: '11px' }}>AGENTS</span>
              <span style={{
                color: simStatus.agentCount > 0 ? '#e94560' : '#ddd',
                fontWeight: 600, fontSize: '11px',
                animation: simStatus.agentCount > 0 ? 'pulse 2s ease-in-out infinite' : undefined,
              }}>{simStatus.agentCount}</span>
            </div>
          </>
        )}
        {hasBgImage && (
          <button
            onClick={onResetBg}
            style={{
              background: 'rgba(155,89,182,0.15)',
              border: '1px solid #9b59b640',
              borderRadius: '4px',
              color: '#9b59b6',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
          >
            Reset BG
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? '#2ecc71' : '#e74c3c',
            display: 'inline-block',
            animation: connected ? undefined : 'pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ color: connected ? '#2ecc71' : '#e74c3c', fontSize: '11px', fontWeight: 500 }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}
