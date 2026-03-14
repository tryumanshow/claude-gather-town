import React, { useEffect } from 'react';
import type { AgentPermissionPayload } from '@theater/shared';

interface Props {
  request: AgentPermissionPayload | null;
  onAnswer: (permissionId: string, approved: boolean) => void;
}

const TOOL_ICONS: Record<string, string> = {
  Bash: '💻',
  Edit: '✏️',
  Write: '📝',
  Read: '📖',
  Glob: '🔍',
  Grep: '🔍',
  Task: '🤖',
  WebFetch: '🌐',
  WebSearch: '🌐',
};

export function PermissionDialog({ request, onAnswer }: Props) {
  useEffect(() => {
    if (!request) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y') onAnswer(request.permissionId, true);
      if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') onAnswer(request.permissionId, false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [request, onAnswer]);

  if (!request) return null;

  const icon = TOOL_ICONS[request.toolName] ?? '🔧';

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        animation: 'questionFadeIn 0.3s ease',
      }}
    >
      <div style={{
        background: 'linear-gradient(180deg, #1e1e3a 0%, #1a1a32 100%)',
        border: '1px solid #f39c1260',
        borderRadius: '14px',
        padding: '28px',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(243,156,18,0.2)',
        animation: 'questionSlideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
          paddingBottom: '16px', borderBottom: '1px solid #2a2a4e',
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f39c12, #e67e22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>{icon}</div>
          <div>
            <div style={{ color: '#f39c12', fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Permission 요청
            </div>
            <div style={{ color: '#ddd', fontSize: '14px', marginTop: '3px', fontWeight: 600 }}>
              {request.toolName}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid #2a2a5e',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '20px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#bbb',
          wordBreak: 'break-all',
          lineHeight: '1.5',
        }}>
          {request.description}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onAnswer(request.permissionId, true)}
            style={{
              flex: 1,
              background: 'rgba(46,204,113,0.15)',
              border: '1px solid #2ecc7160',
              borderRadius: '10px',
              padding: '12px',
              cursor: 'pointer',
              color: '#2ecc71',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.25)';
              (e.currentTarget as HTMLElement).style.borderColor = '#2ecc71';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.15)';
              (e.currentTarget as HTMLElement).style.borderColor = '#2ecc7160';
            }}
          >
            ✅ 허용
          </button>
          <button
            onClick={() => onAnswer(request.permissionId, false)}
            style={{
              flex: 1,
              background: 'rgba(231,76,60,0.15)',
              border: '1px solid #e74c3c60',
              borderRadius: '10px',
              padding: '12px',
              cursor: 'pointer',
              color: '#e74c3c',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(231,76,60,0.25)';
              (e.currentTarget as HTMLElement).style.borderColor = '#e74c3c';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(231,76,60,0.15)';
              (e.currentTarget as HTMLElement).style.borderColor = '#e74c3c60';
            }}
          >
            ❌ 거부
          </button>
        </div>

        <div style={{ color: '#444', fontSize: '10px', marginTop: '12px', textAlign: 'center' }}>
          <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>Y</kbd> 허용 &middot;{' '}
          <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>N</kbd> / <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>Esc</kbd> 거부 &middot; 30초 후 자동 거부
        </div>
      </div>
    </div>
  );
}
