import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { FileListResultPayload, FileReadResultPayload } from '@theater/shared';
import { EventBus } from '../EventBus.ts';
import { IDETerminal } from './IDETerminal.tsx';
import { loadRecentRepos } from '../utils/repoStorage.ts';
import { TreeNode, TreeNodeView, updateTreeNode } from './FileTree.tsx';

interface Props {
  ws: WebSocket | null;
  repoPath: string | null;
  onOpenFolder: (path: string) => void;
}

export function IDEView({ ws, repoPath, onOpenFolder }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const [openTabs, setOpenTabs] = useState<{ path: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [folderInputOpen, setFolderInputOpen] = useState(false);
  const [folderInputValue, setFolderInputValue] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isDraggingRef = useRef(false);
  const isDraggingTermRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Request directory listing
  const requestList = useCallback((dirPath: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'file:list', payload: { dirPath } }));
  }, [ws]);

  // Request file content
  const requestRead = useCallback((filePath: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setLoading(true);
    ws.send(JSON.stringify({ type: 'file:read', payload: { filePath } }));
  }, [ws]);

  // Load root directory & reset terminal on folder change
  useEffect(() => {
    if (repoPath) requestList(repoPath);
    setTerminalId(null);
  }, [repoPath, requestList]);

  // Handle server responses
  useEffect(() => {
    const onListResult = (payload: FileListResultPayload) => {
      if (payload.error) return;

      setTree(prev => {
        // If it's the root path
        if (payload.dirPath === repoPath) {
          return payload.entries.map(e => ({
            ...e,
            children: e.type === 'directory' ? [] : undefined,
            loaded: false,
            expanded: false,
          }));
        }
        // Nested directory — update in tree
        return updateTreeNode(prev, payload.dirPath, node => ({
          ...node,
          children: payload.entries.map(e => ({
            ...e,
            children: e.type === 'directory' ? [] : undefined,
            loaded: false,
            expanded: false,
          })),
          loaded: true,
          expanded: true,
        }));
      });
    };

    const onReadResult = (payload: FileReadResultPayload) => {
      setLoading(false);
      if (payload.error) return;
      setOpenFile({ path: payload.filePath, content: payload.content, language: payload.language });
      const name = payload.filePath.split('/').pop() || payload.filePath;
      setOpenTabs(prev => {
        if (prev.some(t => t.path === payload.filePath)) return prev;
        return [...prev, { path: payload.filePath, name }];
      });
    };

    EventBus.on('ws:file:list:result', onListResult);
    EventBus.on('ws:file:read:result', onReadResult);
    return () => {
      EventBus.off('ws:file:list:result', onListResult);
      EventBus.off('ws:file:read:result', onReadResult);
    };
  }, [repoPath]);

  // Toggle directory expand/collapse
  const handleNodeClick = useCallback((node: TreeNode) => {
    if (node.type === 'directory') {
      if (!node.loaded) {
        requestList(node.path);
      } else {
        setTree(prev => updateTreeNode(prev, node.path, n => ({ ...n, expanded: !n.expanded })));
      }
    } else {
      requestRead(node.path);
    }
  }, [requestList, requestRead]);

  // Close tab
  const handleCloseTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== path);
      if (openFile?.path === path) {
        if (next.length > 0) {
          requestRead(next[next.length - 1].path);
        } else {
          setOpenFile(null);
        }
      }
      return next;
    });
  }, [openFile, requestRead]);

  // Sidebar resize
  const handleSidebarResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSidebarWidth(Math.max(180, Math.min(500, ev.clientX - rect.left)));
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Terminal panel resize
  const handleTermResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingTermRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const editorArea = containerRef.current?.querySelector('[data-editor-area]') as HTMLElement | null;
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingTermRef.current || !editorArea) return;
      const rect = editorArea.getBoundingClientRect();
      const newHeight = rect.bottom - ev.clientY;
      setTerminalHeight(Math.max(100, Math.min(600, newHeight)));
    };
    const onUp = () => {
      isDraggingTermRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const relativePath = (fullPath: string) => {
    if (!repoPath) return fullPath;
    return fullPath.startsWith(repoPath) ? fullPath.slice(repoPath.length + 1) : fullPath;
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flex: 1, background: '#1e1e1e', overflow: 'hidden' }}>
      {/* Sidebar: File tree */}
      <div style={{
        width: `${sidebarWidth}px`,
        background: '#252526',
        borderRight: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Explorer header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#bbbbbb',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          borderBottom: '1px solid #3c3c3c',
        }}>
          <span>Explorer</span>
          <button
            onClick={() => { setFolderInputOpen(v => !v); setTimeout(() => folderInputRef.current?.focus(), 50); }}
            title="Open Folder"
            style={{
              background: 'transparent', border: 'none', color: '#999',
              fontSize: '14px', cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#999'; }}
          >📂</button>
        </div>

        {/* Folder selector */}
        {folderInputOpen && (
          <div style={{
            padding: '8px 10px',
            background: '#2d2d2d',
            borderBottom: '1px solid #3c3c3c',
          }}>
            {/* Hidden native folder picker */}
            <input
              ref={folderPickerRef}
              type="file"
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                const first = files[0] as File & { readonly path?: string };
                if (first.path) {
                  const folderPath = first.path.replace(/[\\/][^\\/]+$/, '');
                  onOpenFolder(folderPath);
                  setFolderInputOpen(false);
                }
                e.target.value = '';
              }}
            />
            <form onSubmit={(e) => {
              e.preventDefault();
              const trimmed = folderInputValue.trim();
              if (trimmed) {
                onOpenFolder(trimmed);
                setFolderInputOpen(false);
                setFolderInputValue('');
              }
            }} style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <input
                ref={folderInputRef}
                type="text"
                value={folderInputValue}
                onChange={e => setFolderInputValue(e.target.value)}
                placeholder="/path/to/project"
                style={{
                  flex: 1, background: '#3c3c3c', border: '1px solid #555',
                  borderRadius: '3px', padding: '4px 8px', color: '#e0e0e0',
                  fontSize: '11px', fontFamily: "'Courier New', monospace", outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#007acc'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#555'; }}
              />
              <button type="submit" disabled={!folderInputValue.trim()} style={{
                background: folderInputValue.trim() ? '#007acc' : '#3c3c3c',
                border: 'none', borderRadius: '3px', color: '#fff',
                padding: '4px 8px', fontSize: '11px', cursor: folderInputValue.trim() ? 'pointer' : 'default',
              }}>Open</button>
              <button type="button" onClick={() => folderPickerRef.current?.click()} title="Browse" style={{
                background: '#3c3c3c', border: '1px solid #555', borderRadius: '3px',
                color: '#ccc', padding: '4px 6px', fontSize: '12px', cursor: 'pointer',
              }}>...</button>
            </form>
            {/* Recent repos */}
            {loadRecentRepos().length > 0 && (
              <div>
                <div style={{ color: '#666', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>RECENT</div>
                {loadRecentRepos().slice(0, 5).map((repo, i) => (
                  <button
                    key={i}
                    onClick={() => { onOpenFolder(repo); setFolderInputOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'transparent', border: 'none', color: '#aaa',
                      fontSize: '10px', fontFamily: "'Courier New', monospace",
                      padding: '3px 6px', cursor: 'pointer', borderRadius: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#094771'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#aaa'; }}
                  >{repo}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Repo name */}
        {repoPath && (
          <div style={{
            padding: '6px 16px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#cccccc',
            background: '#2d2d2d',
            borderBottom: '1px solid #3c3c3c',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {repoPath.split('/').pop()}
          </div>
        )}

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0' }}>
          {!repoPath ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '12px', padding: '20px 16px',
            }}>
              <span style={{ fontSize: '36px', opacity: 0.3 }}>📂</span>
              <span style={{ color: '#888', fontSize: '12px', textAlign: 'center' }}>No folder opened</span>
              <button
                onClick={() => { setFolderInputOpen(true); setTimeout(() => folderInputRef.current?.focus(), 50); }}
                style={{
                  background: '#007acc', border: 'none', borderRadius: '4px',
                  color: '#fff', padding: '6px 16px', fontSize: '12px',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >Open Folder</button>
            </div>
          ) : tree.length === 0 ? (
            <div style={{ padding: '20px 16px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
              Loading...
            </div>
          ) : (
            tree.map(node => (
              <TreeNodeView
                key={node.path}
                node={node}
                depth={0}
                onClick={handleNodeClick}
                activeFile={openFile?.path || null}
              />
            ))
          )}
        </div>
      </div>

      {/* Sidebar resize handle */}
      <div
        onMouseDown={handleSidebarResizeDown}
        style={{
          width: '4px',
          cursor: 'col-resize',
          background: '#3c3c3c',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#007acc'; }}
        onMouseLeave={e => { if (!isDraggingRef.current) e.currentTarget.style.background = '#3c3c3c'; }}
      />

      {/* Editor area */}
      <div data-editor-area style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: '#252526',
          borderBottom: '1px solid #3c3c3c',
          minHeight: '35px',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {openTabs.map(tab => (
            <div
              key={tab.path}
              onClick={() => requestRead(tab.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: openFile?.path === tab.path ? '#fff' : '#999',
                background: openFile?.path === tab.path ? '#1e1e1e' : 'transparent',
                borderRight: '1px solid #3c3c3c',
                borderBottom: openFile?.path === tab.path ? '1px solid #1e1e1e' : '1px solid #3c3c3c',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{tab.name}</span>
              <span
                onClick={(e) => handleCloseTab(tab.path, e)}
                style={{
                  fontSize: '14px',
                  color: '#666',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '0 2px',
                  borderRadius: '3px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#666'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                x
              </span>
            </div>
          ))}
        </div>

        {/* Breadcrumb */}
        {openFile && (
          <div style={{
            padding: '4px 16px',
            fontSize: '11px',
            color: '#888',
            background: '#1e1e1e',
            borderBottom: '1px solid #2d2d2d',
            fontFamily: "'Courier New', monospace",
          }}>
            {relativePath(openFile.path)}
          </div>
        )}

        {/* Monaco editor */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {openFile ? (
            <Editor
              height="100%"
              language={openFile.language}
              value={openFile.content}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
              }}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#555',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>📂</span>
              <span style={{ fontSize: '14px' }}>Select a file to view</span>
            </div>
          )}
        </div>

        {/* Terminal panel */}
        {terminalOpen && (
          <>
            {/* Terminal resize handle */}
            <div
              onMouseDown={handleTermResizeDown}
              style={{
                height: '4px',
                cursor: 'row-resize',
                background: '#3c3c3c',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#007acc'; }}
              onMouseLeave={e => { if (!isDraggingTermRef.current) e.currentTarget.style.background = '#3c3c3c'; }}
            />

            {/* Terminal header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              background: '#252526',
              borderBottom: '1px solid #3c3c3c',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#cccccc', fontSize: '11px', fontWeight: 600 }}>TERMINAL</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => {
                    // Kill current and spawn new
                    if (terminalId && ws && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'terminal:kill', payload: { terminalId } }));
                    }
                    setTerminalId(null);
                    // Force remount by toggling
                    setTerminalOpen(false);
                    setTimeout(() => setTerminalOpen(true), 50);
                  }}
                  title="New Terminal"
                  style={{
                    background: 'transparent', border: 'none', color: '#999',
                    fontSize: '13px', cursor: 'pointer', padding: '2px 6px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#999'; }}
                >+</button>
                <button
                  onClick={() => setTerminalOpen(false)}
                  title="Hide Terminal"
                  style={{
                    background: 'transparent', border: 'none', color: '#999',
                    fontSize: '13px', cursor: 'pointer', padding: '2px 6px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#999'; }}
                >x</button>
              </div>
            </div>

            {/* Terminal body */}
            <div style={{ height: `${terminalHeight}px`, flexShrink: 0 }}>
              <IDETerminal
                key={repoPath || '__no_repo__'}
                cwd={repoPath}
                terminalId={terminalId}
                onTerminalId={setTerminalId}
              />
            </div>
          </>
        )}

        {/* Status bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 12px',
          background: '#007acc',
          fontSize: '11px',
          color: '#fff',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {openFile && <span>{openFile.language}</span>}
            {loading && <span>Loading...</span>}
            {!terminalOpen && (
              <button
                onClick={() => setTerminalOpen(true)}
                style={{
                  background: 'transparent', border: 'none', color: '#fff',
                  fontSize: '11px', cursor: 'pointer', padding: 0,
                  textDecoration: 'underline',
                }}
              >Terminal</button>
            )}
          </div>
          <div>
            {repoPath && <span>{repoPath.split('/').pop()}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
