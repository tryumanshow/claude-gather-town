import type { ZoneDefinition } from './types.js';

// Zone definitions (tile coordinates)
export const ZONES: ZoneDefinition[] = [
  { name: 'planning',       label: 'Planning Room',  x: 1,  y: 1,  width: 38, height: 6,  color: '#9B59B6' },
  { name: 'code-workshop',  label: 'Code Workshop',  x: 1,  y: 8,  width: 18, height: 8,  color: '#4A90D9' },
  { name: 'review-room',    label: 'Review Room',    x: 21, y: 8,  width: 18, height: 8,  color: '#E67E22' },
  { name: 'spawn',          label: 'Central Lobby',  x: 1,  y: 17, width: 38, height: 6,  color: '#2ECC71' },
  { name: 'task-board',     label: 'Task Board',     x: 10, y: 18, width: 20, height: 3,  color: '#F39C12' },
  { name: 'message-center', label: 'Message Center', x: 16, y: 21, width: 8,  height: 2,  color: '#E91E63' },
  { name: 'research-lab',   label: 'Research Lab',   x: 1,  y: 24, width: 38, height: 5,  color: '#1ABC9C' },
  { name: 'tool-forge',     label: 'Tool Forge',     x: 26, y: 21, width: 8,  height: 2,  color: '#E74C3C' },
];
