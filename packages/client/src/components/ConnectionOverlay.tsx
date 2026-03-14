import React, { useState, useEffect } from 'react';
import { EventBus } from '../EventBus.ts';
import { wsClient } from '../ws-client.ts';

export function ConnectionOverlay() {
  // Hydrate initial state from wsClient to avoid StrictMode race
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>(
    () => wsClient.isConnected ? 'connected' : 'connecting'
  );
  const [showOverlay, setShowOverlay] = useState(() => !wsClient.isConnected);

  useEffect(() => {
    const onConnect = () => {
      setStatus('connected');
      // Hide overlay after brief success display
      setTimeout(() => setShowOverlay(false), 800);
    };
    const onDisconnect = () => {
      setStatus('disconnected');
      setShowOverlay(true);
    };

    EventBus.on('ws:connected', onConnect);
    EventBus.on('ws:disconnected', onDisconnect);

    return () => {
      EventBus.off('ws:connected', onConnect);
      EventBus.off('ws:disconnected', onDisconnect);
    };
  }, []);

  if (!showOverlay) return null;

  const isConnecting = status === 'connecting' || status === 'disconnected';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isConnecting ? 'rgba(10, 10, 26, 0.85)' : 'rgba(10, 10, 26, 0.6)',
      zIndex: 200,
      transition: 'all 0.5s ease',
      backdropFilter: isConnecting ? 'blur(4px)' : 'none',
    }}>
      <div style={{
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease',
      }}>
        {isConnecting ? (
          <>
            <div style={{
              fontSize: '32px',
              marginBottom: '16px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              🎭
            </div>
            <div style={{
              color: '#e0e0e0',
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '8px',
            }}>
              {status === 'connecting' ? 'Connecting to Theater...' : 'Reconnecting...'}
            </div>
            <div style={{
              color: '#555',
              fontSize: '12px',
            }}>
              {status === 'disconnected'
                ? 'Connection lost. Attempting to reconnect...'
                : 'Setting up the stage'}
            </div>
          </>
        ) : (
          <div style={{
            color: '#2ecc71',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            Connected
          </div>
        )}
      </div>
    </div>
  );
}
