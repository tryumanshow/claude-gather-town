import React, { useState, useEffect } from 'react';

export function HelpOverlay() {
  const [visible, setVisible] = useState(false);

  // Toggle with 'H' key (only when not focused on input)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        title="Show help (H)"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(22, 33, 62, 0.9)',
          border: '1px solid #2a2a5e',
          color: '#888',
          width: '28px',
          height: '28px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 700,
          borderRadius: '6px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        ?
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(13, 27, 42, 0.95)',
      border: '1px solid #2a2a5e',
      borderRadius: '10px',
      padding: '14px 18px',
      fontSize: '12px',
      lineHeight: '1.7',
      color: '#bbb',
      zIndex: 100,
      maxWidth: '320px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid #1a1a4e',
      }}>
        <span style={{ color: '#e94560', fontWeight: 700, fontSize: '13px' }}>
          Quick Reference
        </span>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '4px',
            padding: '2px 8px',
          }}
        >
          H
        </button>
      </div>

      <div style={{ color: '#e94560', fontWeight: 600, fontSize: '11px', marginBottom: '3px' }}>Getting Started</div>
      <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>
        1. 하단에서 모드 또는 Quick Action을 선택<br/>
        2. 태스크를 입력하고 Send
      </div>

      <div style={{ color: '#f39c12', fontWeight: 600, fontSize: '11px', marginBottom: '3px' }}>Modes</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#4A90D9' }}>Single</span> — 1명이 집중 처리 (디버깅, 리팩토링)</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#2ECC71' }}>Subagent</span> — 여러 에이전트가 병렬 분담</div>
      <div style={{ fontSize: '11px', marginBottom: '8px' }}><span style={{ color: '#E91E63' }}>Teams</span> — Morgan이 팀 구성 후 자율 협업</div>

      <div style={{ color: '#f39c12', fontWeight: 600, fontSize: '11px', marginBottom: '3px' }}>Quick Actions</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#e94560' }}>Team Feature</span> — 기획 &rarr; 구현 &rarr; 리뷰 파이프라인</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#e74c3c' }}>Debug</span> — 버그 원인 분석 및 수정</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#2ecc71' }}>Explore</span> — 코드베이스 병렬 탐색</div>
      <div style={{ fontSize: '11px' }}><span style={{ color: '#e67e22' }}>Code Review</span> — 품질/보안 검토</div>
      <div style={{ fontSize: '11px', marginBottom: '8px' }}><span style={{ color: '#9b59b6' }}>Refactor</span> — 코드 구조 개선</div>

      <div style={{ color: '#f39c12', fontWeight: 600, fontSize: '11px', marginBottom: '3px' }}>Tips</div>
      <div style={{ fontSize: '11px', color: '#888' }}>
        에이전트 이름을 언급하면 해당 에이전트가 응답<br/>
        모드 없이 입력하면 Single 모드로 자동 실행
      </div>

      <div style={{
        color: '#555',
        fontSize: '10px',
        borderTop: '1px solid #1a1a4e',
        paddingTop: '8px',
        marginTop: '8px',
        lineHeight: '1.8',
      }}>
        <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#888', fontSize: '10px' }}>WASD</kbd> Move
        &nbsp;&middot;&nbsp;
        <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#888', fontSize: '10px' }}>Scroll</kbd> Zoom
        &nbsp;&middot;&nbsp;
        <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#888', fontSize: '10px' }}>H</kbd> Toggle help
        &nbsp;&middot;&nbsp;
        <kbd style={{ background: '#1a1a3e', padding: '1px 5px', borderRadius: '3px', color: '#888', fontSize: '10px' }}>/</kbd> Focus input
      </div>
    </div>
  );
}
