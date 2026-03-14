import React, { useState, useRef, useCallback } from 'react';

type ExecMode = 'single' | 'subagent' | 'teams';

interface Props {
  onSubmit: (command: string, mode: ExecMode | null) => void;
  hasRepo?: boolean;  // true when a codebase is selected
}

const MODE_OPTIONS: { mode: ExecMode; label: string; icon: string; color: string; desc: string; detail: string }[] = [
  { mode: 'single',   label: 'Single',   icon: '👤', color: '#4A90D9', desc: '단일 에이전트', detail: '1명이 집중해서 처리\n빠르고 단순한 태스크에 적합' },
  { mode: 'subagent', label: 'Subagent', icon: '🤖', color: '#2ECC71', desc: '병렬 서브에이전트', detail: '여러 에이전트가 동시에 분담\n독립적인 작업 병렬 처리에 적합' },
  { mode: 'teams',    label: 'Teams',    icon: '👥', color: '#E91E63', desc: 'Claude Code 팀 협업', detail: 'Morgan이 팀 구성 후 에이전트 자율 조율\nClaude Code 네이티브 팀 도구 사용' },
];

const QUICK_ACTIONS: { label: string; mode: ExecMode; color: string; icon: string; desc: string; detail: string; placeholder: string }[] = [
  { label: 'Team Feature', mode: 'teams', color: '#e94560', icon: '🚀',
    desc: '팀 전체가 협업하여 새 기능 구현', detail: '기획(CTO) → 구현(Dev) → 리뷰(QA) 파이프라인\nTeams 모드로 실행됩니다',
    placeholder: '구현할 기능을 설명하세요...' },
  { label: 'Debug', mode: 'single', color: '#e74c3c', icon: '🐛',
    desc: '버그 원인 분석 및 수정', detail: '단일 에이전트가 집중 디버깅\n로그·스택트레이스 분석 후 패치',
    placeholder: '디버깅할 버그를 설명하세요...' },
  { label: 'Explore', mode: 'subagent', color: '#2ecc71', icon: '🔍',
    desc: '코드베이스 병렬 탐색·분석', detail: '서브에이전트들이 동시에 코드 탐색\n아키텍처·의존성·패턴 파악',
    placeholder: '탐색할 내용을 설명하세요...' },
  { label: 'Code Review', mode: 'teams', color: '#e67e22', icon: '👁️',
    desc: '코드 품질·보안·가독성 검토', detail: '팀 에이전트들이 관점별 리뷰\n보안·성능·유지보수성 분석',
    placeholder: '리뷰할 대상을 설명하세요...' },
  { label: 'Refactor', mode: 'single', color: '#9b59b6', icon: '♻️',
    desc: '코드 구조 개선 및 정리', detail: '단일 에이전트가 리팩토링\n중복 제거·구조 개선·타입 정리',
    placeholder: '리팩토링할 대상을 설명하세요...' },
];

export function CommandInput({ onSubmit, hasRepo = false }: Props) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ExecMode | null>(null);
  const [hoveredMode, setHoveredMode] = useState<ExecMode | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<typeof QUICK_ACTIONS[0] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const doSubmit = useCallback(() => {
    const cmd = value.trim();
    if (!cmd) return;
    onSubmit(cmd, selectedMode);
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setValue('');
    setActiveAction(null);
    setSelectedMode(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, selectedMode, onSubmit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = submit, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      doSubmit();
      return;
    }

    if (e.key === 'ArrowUp' && !value.includes('\n')) {
      e.preventDefault();
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      if (newIndex >= 0) setValue(history[history.length - 1 - newIndex]);
    } else if (e.key === 'ArrowDown' && !value.includes('\n')) {
      e.preventDefault();
      const newIndex = historyIndex > 0 ? historyIndex - 1 : -1;
      setHistoryIndex(newIndex);
      setValue(newIndex >= 0 ? history[history.length - 1 - newIndex] : '');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleChipClick = (action: typeof QUICK_ACTIONS[0]) => {
    // If there's already text in the input, submit it with this action's mode
    const cmd = value.trim();
    if (cmd) {
      onSubmit(cmd, action.mode);
      setHistory(prev => [...prev, cmd]);
      setValue('');
      setActiveAction(null);
      setSelectedMode(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } else {
      // No text — set mode and focus input so user types the task description
      const isSame = activeAction?.label === action.label;
      setActiveAction(isSame ? null : action);
      setSelectedMode(isSame ? null : action.mode);
      textareaRef.current?.focus();
    }
  };

  const activeMode = selectedMode ? MODE_OPTIONS.find(m => m.mode === selectedMode) : null;
  const borderColor = activeMode ? activeMode.color : (focused ? '#e94560' : '#1a1a4e');

  return (
    <div style={{ background: '#0d1b2a', borderTop: `1px solid ${borderColor}`, transition: 'border-color 0.2s ease', flexShrink: 0 }}>
      {/* Mode selector + Quick actions row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 36px 0',
        flexWrap: 'wrap',
      }}>
        {/* Mode buttons — 1.5x */}
        <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
          {MODE_OPTIONS.map(opt => {
            const isActive = selectedMode === opt.mode;
            const isHovered = hoveredMode === opt.mode;
            return (
              <div key={opt.mode} style={{ position: 'relative' }}>
                <button
                  onClick={() => setSelectedMode(isActive ? null : opt.mode)}
                  onMouseEnter={() => setHoveredMode(opt.mode)}
                  onMouseLeave={() => setHoveredMode(null)}
                  style={{
                    background: isActive ? `${opt.color}28` : (isHovered ? `${opt.color}18` : `${opt.color}10`),
                    border: `${isActive ? '2px' : '1px'} solid ${isActive ? opt.color : (isHovered ? `${opt.color}80` : `${opt.color}55`)}`,
                    borderRadius: '8px',
                    color: isActive ? opt.color : (isHovered ? `${opt.color}ee` : `${opt.color}aa`),
                    padding: isActive ? '5px 15px' : '6px 16px',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    opacity: 1,
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: isActive ? `0 0 12px ${opt.color}35` : 'none',
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
                {isHovered && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1a1a3e', border: `1px solid ${opt.color}60`,
                    borderRadius: '8px', padding: '8px 12px',
                    minWidth: '160px', zIndex: 300, pointerEvents: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{ color: opt.color, fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                      {opt.icon} {opt.label}
                    </div>
                    <div style={{ color: '#aaa', fontSize: '11px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                      {opt.detail}
                    </div>
                    {/* Arrow */}
                    <div style={{
                      position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
                      width: 0, height: 0,
                      borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                      borderTop: `5px solid ${opt.color}60`,
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: '#2a2a4e', flexShrink: 0 }} />

        {/* Quick action chips — disabled when no repo */}
        {QUICK_ACTIONS.map(action => {
          const isHovered = hoveredAction === action.label;
          const isActive = activeAction?.label === action.label;
          return (
            <div key={action.label} style={{ position: 'relative' }}>
              <button
                onClick={() => handleChipClick(action)}
                onMouseEnter={() => setHoveredAction(action.label)}
                onMouseLeave={() => setHoveredAction(null)}
                style={{
                  background: isActive ? `${action.color}35` : (isHovered ? `${action.color}30` : `${action.color}18`),
                  border: `${isActive ? '2px' : '1px'} solid ${isActive ? action.color : (isHovered ? `${action.color}80` : `${action.color}40`)}`,
                  color: action.color,
                  borderRadius: '16px',
                  padding: isActive ? '5px 17px' : '6px 18px',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  opacity: 1,
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {action.icon} {action.label}
              </button>
              {isHovered && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#1a1a3e', border: `1px solid ${action.color}60`,
                  borderRadius: '8px', padding: '8px 12px',
                  minWidth: '200px', zIndex: 300, pointerEvents: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ color: action.color, fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                    {action.icon} {action.label}
                  </div>
                  <div style={{ color: '#ccc', fontSize: '11px', marginBottom: '4px' }}>
                    {action.desc}
                  </div>
                  <div style={{ color: '#888', fontSize: '10px', lineHeight: '1.5', whiteSpace: 'pre-line', borderTop: '1px solid #2a2a5e', paddingTop: '5px', marginTop: '4px' }}>
                    {action.detail}
                  </div>
                  {/* Arrow */}
                  <div style={{
                    position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                    borderTop: `5px solid ${action.color}60`,
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input row — 1.5x, textarea for multiline */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        alignItems: 'flex-end',
        padding: '18px 36px 24px',
      }}>
        <span style={{
          color: activeMode ? activeMode.color : (focused ? '#e94560' : '#555'),
          marginRight: '16px',
          fontWeight: 'bold',
          fontSize: '36px',
          transition: 'color 0.2s ease',
          lineHeight: '1',
          paddingBottom: '8px',
        }}>&gt;</span>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={activeAction ? `[${activeAction.icon} ${activeAction.label}] ${activeAction.placeholder}` : (activeMode ? `[${activeMode.label}] ${activeMode.desc}...` : 'Say hi, or describe a task... (Shift+Enter for newline)')}
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#e0e0e0',
            fontSize: '30px',
            fontFamily: 'inherit',
            outline: 'none',
            padding: '15px 0',
            resize: 'none',
            overflow: 'hidden',
            lineHeight: '1.3',
          }}
        />
        <button
          type="submit"
          style={{
            background: value.trim() ? (activeMode?.color || '#e94560') : '#2a2a4e',
            border: 'none',
            borderRadius: '8px',
            color: value.trim() ? '#fff' : '#555',
            padding: '21px 42px',
            fontSize: '27px',
            fontWeight: 600,
            cursor: value.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            marginLeft: '16px',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
