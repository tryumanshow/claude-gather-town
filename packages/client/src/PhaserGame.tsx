import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { WorldScene } from './game/scenes/WorldScene.ts';
import { UIScene } from './game/scenes/UIScene.ts';

export function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    try {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: containerRef.current.clientWidth || 800,
        height: containerRef.current.clientHeight || 600,
        backgroundColor: '#0a0a1a',
        roundPixels: false,
        antialias: true,
        dom: { createContainer: true },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [WorldScene, UIScene],
      };

      gameRef.current = new Phaser.Game(config);
    } catch (err) {
      console.error('Phaser init error:', err);
      setError(String(err));
    }

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: 20, color: '#e74c3c', fontFamily: 'monospace', fontSize: 14 }}>
        <strong>Phaser Error:</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
