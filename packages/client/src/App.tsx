import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDraggableResize } from './hooks/useDraggableResize.ts';
import { saveBgImage, loadBgImage, clearBgImage, saveDefaultBgImage, loadDefaultBgImage } from './bg-db.ts';
import { PhaserGame } from './PhaserGame.tsx';
import { CommandInput } from './components/CommandInput.tsx';
import { CCLogPanel } from './components/CCLogPanel.tsx';
import { AgentStatus } from './components/AgentStatus.tsx';
import { TaskBoard } from './components/TaskBoard.tsx';
import { HelpOverlay } from './components/HelpOverlay.tsx';
import { QuestionOverlay } from './components/QuestionOverlay.tsx';
import { PermissionDialog } from './components/PermissionDialog.tsx';
import { SetupScreen } from './components/SetupScreen.tsx';
import { ConnectionOverlay } from './components/ConnectionOverlay.tsx';
import { RepoBar } from './components/RepoBar.tsx';
import { IDEView } from './components/IDEView.tsx';
import { HeaderBar } from './components/HeaderBar.tsx';
import { wsClient } from './ws-client.ts';
import { EventBus } from './EventBus.ts';
import { processDroppedImage } from './utils/imageProcessing.ts';
import { AUTH_STORAGE_KEY, loadSavedAuth, saveAuth } from './utils/authStorage.ts';
import type { AgentPermissionPayload, AuthStatusPayload, LeadQuestionPayload, RepoStatusPayload, SimStatusPayload } from '@theater/shared';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(() => {
    const saved = loadSavedAuth();
    return saved?.configured ? saved : null;
  });
  const [connected, setConnected] = useState(false);
  const [repoStatus, setRepoStatus] = useState<RepoStatusPayload | null>(null);
  const [simStatus, setSimStatus] = useState<SimStatusPayload | null>(null);
  const [questionData, setQuestionData] = useState<LeadQuestionPayload | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<AgentPermissionPayload | null>(null);
  const [viewMode, setViewMode] = useState<'gather' | 'ide'>('gather');
  const [panelOpen, setPanelOpen] = useState(true);
  const [draggingOver, setDraggingOver] = useState(false);
  const [hasBgImage, setHasBgImage] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5); // 50% game, 50% panel
  const playerPosRef = useRef<{ x: number; y: number }>({ x: 640, y: 640 });
  const dragCounterRef = useRef(0);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef(false);
  const {
    size: taskBoardHeight,
    onMouseDown: handleTaskBoardResizeMouseDown,
    isDraggingRef: isDraggingTaskBoardRef,
  } = useDraggableResize({ direction: 'vertical', min: 80, max: 500, initial: 180, invert: true });
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Dynamic tab title
  useEffect(() => {
    const count = simStatus?.agentCount ?? 0;
    const mode = simStatus?.mode || 'idle';
    document.title = count > 0
      ? `(${count}) ${mode} - Claude Gather.town`
      : 'Claude Gather.town';
  }, [simStatus]);

  useEffect(() => {
    wsClient.connect();

    const onConnected = () => {
      setConnected(true);
      loadBgImage().then(async savedBg => {
        const bgToUse = savedBg ?? await (async () => {
          // No saved bg — fetch the bundled default and persist it
          try {
            const res = await fetch('/bg-default.jpg');
            const blob = await res.blob();
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            }).then(async dataUrl => {
              await saveBgImage(dataUrl).catch(() => {});
              await saveDefaultBgImage(dataUrl).catch(() => {});
              return dataUrl;
            });
          } catch { return null; }
        })();
        if (!bgToUse) return;
        setHasBgImage(true);
        EventBus.emit('bg:set', bgToUse);
        const img = new Image();
        img.onload = () => {
          wsClient.send({
            type: 'bg:analyze',
            payload: { imageData: bgToUse, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight },
          });
        };
        img.src = bgToUse;
      }).catch(() => {});
    };
    const onDisconnected = () => setConnected(false);
    const onStatus = (payload: SimStatusPayload) => {
      setSimStatus(payload);
    };
    const onQuestion = (payload: LeadQuestionPayload) => {
      setQuestionData(payload);
    };
    const onPosition = (pos: { x: number; y: number }) => {
      playerPosRef.current = pos;
    };
    const onRepoStatus = (payload: RepoStatusPayload) => {
      setRepoStatus(payload);
    };
    const onPermission = (payload: AgentPermissionPayload) => {
      setPermissionRequest(payload);
    };
    const onAuthStatus = (payload: AuthStatusPayload) => {
      if (payload.configured) {
        saveAuth(payload);
        setAuthStatus(payload);
      } else {
        // Only show setup screen if no saved auth in localStorage
        const saved = loadSavedAuth();
        if (!saved?.configured) setAuthStatus(payload);
      }
    };

    EventBus.on('ws:connected', onConnected);
    EventBus.on('ws:disconnected', onDisconnected);
    EventBus.on('ws:sim:status', onStatus);
    EventBus.on('ws:lead:question', onQuestion);
    EventBus.on('player:position', onPosition);
    EventBus.on('ws:repo:status', onRepoStatus);
    EventBus.on('ws:agent:permission', onPermission);
    EventBus.on('ws:setup:auth_status', onAuthStatus);

    return () => {
      EventBus.off('ws:connected', onConnected);
      EventBus.off('ws:disconnected', onDisconnected);
      EventBus.off('ws:sim:status', onStatus);
      EventBus.off('ws:lead:question', onQuestion);
      EventBus.off('player:position', onPosition);
      EventBus.off('ws:repo:status', onRepoStatus);
      EventBus.off('ws:agent:permission', onPermission);
      EventBus.off('ws:setup:auth_status', onAuthStatus);
    };
  }, []);

  const handleQuestionAnswer = useCallback((optionIndex: number) => {
    if (questionData) {
      wsClient.send({ type: 'question:answer', payload: { questionId: questionData.id, optionIndex } });
      setQuestionData(null);
    }
  }, [questionData]);

  const handlePermissionAnswer = useCallback((permissionId: string, approved: boolean) => {
    wsClient.send({ type: 'player:permission_answer', payload: { permissionId, approved } });
    setPermissionRequest(null);
  }, []);

  const handleSendApiKey = useCallback((apiKey: string) => {
    wsClient.send({ type: 'setup:set_apikey', payload: { apiKey } });
  }, []);

  const handleCheckOAuth = useCallback(() => {
    wsClient.send({ type: 'setup:check_oauth', payload: {} });
  }, []);

  const handleResetAuth = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // Show SetupScreen — claudeInstalled hint stays true for UX
    setAuthStatus({ configured: false, claudeInstalled: true, method: undefined });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const { dataUrl, width, height } = await processDroppedImage(file);
    await saveBgImage(dataUrl);
    await saveDefaultBgImage(dataUrl);  // persist as default for Reset BG
    setHasBgImage(true);
    EventBus.emit('bg:set', dataUrl);
    wsClient.send({
      type: 'bg:analyze',
      payload: { imageData: dataUrl, imageWidth: width, imageHeight: height, force: true },
    });
  }, []);

  const handleResetBg = useCallback(async () => {
    const defaultBg = await loadDefaultBgImage().catch(() => null);
    if (defaultBg) {
      await saveBgImage(defaultBg).catch(() => {});
      setHasBgImage(true);
      EventBus.emit('bg:set', defaultBg);
      // Re-apply cached seat positions (no force = uses bg-seats.json cache)
      const img = new Image();
      img.onload = () => {
        wsClient.send({
          type: 'bg:analyze',
          payload: { imageData: defaultBg, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight },
        });
      };
      img.src = defaultBg;
    } else {
      // No custom default saved — restore bundled default image
      try {
        const res = await fetch('/bg-default.jpg');
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await saveBgImage(dataUrl).catch(() => {});
        await saveDefaultBgImage(dataUrl).catch(() => {});
        setHasBgImage(true);
        EventBus.emit('bg:set', dataUrl);
        const img = new Image();
        img.onload = () => {
          wsClient.send({
            type: 'bg:analyze',
            payload: { imageData: dataUrl, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight },
          });
        };
        img.src = dataUrl;
      } catch {
        clearBgImage().catch(() => {});
        setHasBgImage(false);
        EventBus.emit('bg:clear');
      }
    }
  }, []);

  // Draggable split divider handlers
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingSplitRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.25, Math.min(0.85, ratio)));
    };
    const onMouseUp = () => {
      isDraggingSplitRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleCommand = useCallback((cmd: string, mode: 'single' | 'subagent' | 'teams' | null = null) => {
    if (cmd.startsWith('/speed ')) {
      const value = parseFloat(cmd.replace('/speed ', ''));
      wsClient.send({ type: 'control', payload: { action: 'speed', value } });
      return;
    }
    if (cmd === '/reset') {
      wsClient.send({ type: 'control', payload: { action: 'reset' } });
      return;
    }

    EventBus.emit('player:chat', cmd);

    wsClient.send({
      type: 'command',
      payload: {
        raw: cmd,
        playerX: playerPosRef.current.x,
        playerY: playerPosRef.current.y,
        ...(mode ? { mode } : {}),
      },
    });
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      position: 'fixed',
      inset: 0,
      background: '#0f0f23',
    }}>
      <HeaderBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        simStatus={simStatus}
        connected={connected}
        hasBgImage={hasBgImage}
        onResetBg={handleResetBg}
        onResetAuth={handleResetAuth}
      />

      {/* Office view — always in normal flow, never changes layout */}
      <div ref={splitContainerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* IDE overlay — floats on top when active */}
        {viewMode === 'ide' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
            background: '#1e1e1e',
          }}>
            <IDEView
              ws={wsClient.getSocket()}
              repoPath={repoStatus?.path || null}
              onOpenFolder={(path) => {
                wsClient.send({ type: 'repo:select', payload: { path, action: 'select' } });
              }}
            />
          </div>
        )}
        {/* Game canvas — left side */}
        <div
          style={{ width: panelOpen ? `${splitRatio * 100}%` : '100%', position: 'relative', minWidth: 0, transition: panelOpen ? undefined : 'width 0.3s ease' }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <PhaserGame />
          {authStatus && !authStatus.configured && (
            <SetupScreen authStatus={authStatus} onSendApiKey={handleSendApiKey} onCheckOAuth={handleCheckOAuth} />
          )}
          <ConnectionOverlay />
          {viewMode === 'gather' && <HelpOverlay />}
          {viewMode === 'gather' && questionData && <QuestionOverlay data={questionData} onAnswer={handleQuestionAnswer} />}
          {viewMode === 'gather' && <PermissionDialog request={permissionRequest} onAnswer={handlePermissionAnswer} />}
          {draggingOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 100,
              background: 'rgba(233,69,96,0.15)',
              border: '3px dashed #e94560',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{
                color: '#fff', fontSize: '18px', fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: '8px',
              }}>
                Drop image to set background
              </span>
            </div>
          )}

          {/* AgentStatus overlay — bottom-left of game canvas */}
          <AgentStatus overlay />
        </div>

        {/* Draggable divider */}
        {panelOpen && (
          <div
            onMouseDown={handleSplitMouseDown}
            style={{
              width: '6px',
              cursor: 'col-resize',
              background: 'linear-gradient(180deg, #2a2a5e 0%, #1a1a3e 50%, #2a2a5e 100%)',
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(180deg, #e94560 0%, #e9456080 50%, #e94560 100%)'; }}
            onMouseLeave={e => {
              if (!isDraggingSplitRef.current) {
                e.currentTarget.style.background = 'linear-gradient(180deg, #2a2a5e 0%, #1a1a3e 50%, #2a2a5e 100%)';
              }
            }}
          >
            {/* Grip dots */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#555' }} />
              ))}
            </div>
          </div>
        )}

        {/* Right panel: CC Log + TaskBoard */}
        <div
          ref={rightPanelRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: panelOpen ? `${(1 - splitRatio) * 100}%` : '0',
            minWidth: panelOpen ? 375 : 0,
            transition: panelOpen ? undefined : 'width 0.3s ease, min-width 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}>
          {/* Panel toggle */}
          <button
            onClick={() => setPanelOpen(v => !v)}
            style={{
              position: 'absolute',
              left: '-20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 50,
              background: '#111',
              border: '1px solid #2a2a5e',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              color: '#666',
              padding: '12px 5px',
              cursor: 'pointer',
              fontSize: '11px',
              lineHeight: 1,
            }}
          >
            {panelOpen ? '›' : '‹'}
          </button>

          {/* Repo selector bar */}
          {viewMode === 'gather' && <RepoBar ws={wsClient.getSocket()} repoStatus={repoStatus} onResetAuth={handleResetAuth} />}

          {/* CC Log Panel — main area */}
          <CCLogPanel />

          {/* Horizontal drag handle between CCLogPanel and TaskBoard */}
          <div
            onMouseDown={handleTaskBoardResizeMouseDown}
            style={{
              height: '6px',
              cursor: 'row-resize',
              background: 'linear-gradient(90deg, #2a2a5e 0%, #1a1a3e 50%, #2a2a5e 100%)',
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(90deg, #e94560 0%, #e9456080 50%, #e94560 100%)'; }}
            onMouseLeave={e => {
              if (!isDraggingTaskBoardRef.current) {
                e.currentTarget.style.background = 'linear-gradient(90deg, #2a2a5e 0%, #1a1a3e 50%, #2a2a5e 100%)';
              }
            }}
          >
            {/* Grip dots */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'row', gap: '3px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#555' }} />
              ))}
            </div>
          </div>

          {/* TaskBoard — bottom, resizable */}
          <div style={{
            height: `${taskBoardHeight}px`,
            overflow: 'auto',
            flexShrink: 0,
          }}>
            <TaskBoard />
          </div>
        </div>
      </div>

      {/* Command input — 1.5x size */}
      <CommandInput onSubmit={handleCommand} hasRepo={!!repoStatus?.path} />
    </div>
  );
}
