import React, { useEffect, useRef, useState } from 'react';
import type { RepoStatusPayload } from '@theater/shared';
import { EventBus } from '../EventBus.ts';
import { loadRecentRepos, saveRecentRepo } from '../utils/repoStorage.ts';

interface Props {
  ws: WebSocket | null;
  repoStatus: RepoStatusPayload | null;
  onResetAuth: () => void;
}

export function RepoBar({ ws, repoStatus, onResetAuth }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [recentRepos, setRecentRepos] = useState<string[]>(() => loadRecentRepos());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const onRepoStatus = (payload: RepoStatusPayload) => {
      setLoading(false);
      if (payload.path) saveRecentRepo(payload.path);
      setRecentRepos(loadRecentRepos());
      setOpen(false);
      setError(null);
    };
    EventBus.on('ws:repo:status', onRepoStatus);
    return () => { EventBus.off('ws:repo:status', onRepoStatus); };
  }, []);

  const send = (path: string, action: 'select' | 'scratch') => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setLoading(true);
    setError(null);
    ws.send(JSON.stringify({ type: 'repo:select', payload: { path, action } }));
    // Reset simulation for new session
    ws.send(JSON.stringify({ type: 'control', payload: { action: 'reset' } }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) send(trimmed, 'select');
  };

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const first = files[0] as File & { path?: string };
    if (first.path) {
      const folderPath = first.path.replace(/[\\/][^\\/]+$/, '');
      setInputValue(folderPath);
      send(folderPath, 'select');
    } else {
      const rel = (first as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      setInputValue(rel.split('/')[0]);
      setError('전체 경로를 직접 입력해주세요.');
    }
    e.target.value = '';
  };

  // Repo label
  const label = repoStatus?.name || repoStatus?.fromScratch ? (repoStatus.name || 'scratch') : 'No repo';
  const hasRepo = !!(repoStatus?.path || repoStatus?.fromScratch);

  return (
    <div style={{ position: 'relative', zIndex: 60 }} ref={dropdownRef}>
      {/* Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 10px',
        background: '#111',
        borderBottom: '1px solid #1e1e3e',
        minHeight: '34px',
      }}>
        {/* Repo selector button */}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: hasRepo ? '#b0c4de' : '#555',
            fontSize: '11px',
            fontFamily: "'Courier New', monospace",
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'background 0.15s',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          title="레포지토리 선택"
        >
          <span style={{ fontSize: '13px' }}>📁</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ color: '#444', marginLeft: 'auto', flexShrink: 0 }}>▾</span>
        </button>

        {/* Auth reset button */}
        <button
          onClick={onResetAuth}
          title="인증 다시 설정"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#444',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '3px 6px',
            borderRadius: '4px',
            flexShrink: 0,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#e94560';
            (e.currentTarget as HTMLElement).style.background = 'rgba(233,69,96,0.08)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#444';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >⚙️</button>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'linear-gradient(180deg, #1e1e3a 0%, #1a1a32 100%)',
          border: '1px solid #2a2a5e',
          borderTop: 'none',
          padding: '12px',
          zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {/* Hidden folder picker */}
          <input
            ref={folderPickerRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            style={{ display: 'none' }}
            onChange={handleFolderPick}
          />

          {/* Path input */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="/path/to/your/project"
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #2a2a5e',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#e0e0e0',
                  fontSize: '11px',
                  fontFamily: "'Courier New', monospace",
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#e94560'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#2a2a5e'; }}
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                style={{
                  background: inputValue.trim() && !loading ? 'linear-gradient(135deg,#e94560,#c0392b)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid #e9456040',
                  borderRadius: '6px',
                  color: inputValue.trim() && !loading ? '#fff' : '#555',
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >{loading ? '...' : 'Open'}</button>
              <button
                type="button"
                onClick={() => folderPickerRef.current?.click()}
                disabled={loading}
                title="폴더 선택"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #2a2a5e',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#aaa',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >🔽</button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div style={{ color: '#e74c3c', fontSize: '10px', marginBottom: '8px' }}>{error}</div>
          )}

          {/* Recent repos */}
          {recentRepos.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#555', fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '4px' }}>Recent</div>
              {recentRepos.map((repo, i) => (
                <button
                  key={i}
                  onClick={() => send(repo, 'select')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid #2a2a4e',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    color: '#b0b8c0',
                    fontSize: '10px',
                    fontFamily: "'Courier New', monospace",
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '3px',
                    display: 'block',
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'rgba(233,69,96,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                >{repo}</button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: '#2a2a4e', margin: '8px 0' }} />

          {/* Scratch */}
          <button
            onClick={() => send('', 'scratch')}
            disabled={loading}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid #2a2a4e',
              borderRadius: '6px',
              padding: '7px 10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              color: '#2ecc71',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <span>✨</span>
            <span>Start from scratch</span>
          </button>
        </div>
      )}
    </div>
  );
}
