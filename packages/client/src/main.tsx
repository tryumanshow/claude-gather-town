import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Note: StrictMode is intentionally omitted.
// Phaser.Game manages its own lifecycle (canvas, game loop, rAF).
// StrictMode's dev-only double-mount creates two simultaneous Phaser instances
// because Game.destroy() is deferred to the next animation frame, causing
// "Cannot read properties of null (reading 'drawImage')" crashes.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
