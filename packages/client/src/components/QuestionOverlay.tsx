import React, { useEffect } from 'react';
import type { LeadQuestionPayload } from '@theater/shared';

interface Props {
  data: LeadQuestionPayload;
  onAnswer: (optionIndex: number) => void;
  onDismiss?: () => void;
}

const MODE_ICONS = ['🧑‍💻', '👥', '🏢'];

export function QuestionOverlay({ data, onAnswer, onDismiss }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onAnswer(0);
      }
      const num = parseInt(e.key);
      if (num >= 1 && num <= data.options.length) {
        onAnswer(num - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [data, onAnswer]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        animation: 'questionFadeIn 0.3s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && onDismiss) onDismiss(); }}
    >
      <div style={{
        background: 'linear-gradient(180deg, #1e1e3a 0%, #1a1a32 100%)',
        border: '1px solid #3a3a6e',
        borderRadius: '14px',
        padding: '28px',
        maxWidth: '440px',
        width: '90%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(233,69,96,0.2)',
        animation: 'questionSlideUp 0.3s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
          paddingBottom: '16px', borderBottom: '1px solid #2a2a4e',
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #e94560, #c0392b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>👔</div>
          <div>
            <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '13px', letterSpacing: '-0.2px' }}>Team Lead</div>
            <div style={{ color: '#ddd', fontSize: '14px', marginTop: '3px', lineHeight: '1.4' }}>{data.question}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #2a2a5e',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                color: '#e0e0e0',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(233,69,96,0.1)';
                (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
                (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = '#2a2a5e';
                (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{MODE_ICONS[i] ?? '🔧'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px' }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: '#888', lineHeight: '1.3' }}>{opt.description}</div>
                </div>
                <kbd style={{
                  background: '#1a1a3e', color: '#666', borderRadius: '4px',
                  padding: '2px 7px', fontSize: '11px', fontWeight: 700,
                  border: '1px solid #2a2a4e',
                }}>{i + 1}</kbd>
              </div>
            </button>
          ))}
        </div>
        <div style={{ color: '#444', fontSize: '10px', marginTop: '14px', textAlign: 'center' }}>
          Press <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>1</kbd>-<kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>3</kbd> to select &middot; <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>Esc</kbd> for default
        </div>
      </div>
    </div>
  );
}
