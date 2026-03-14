import type { AgentType } from './types.js';

export const TILE_SIZE = 32;
export const MAP_WIDTH = 40;  // tiles
export const MAP_HEIGHT = 30; // tiles

// Agent colors by type
export const AGENT_COLORS: Record<AgentType, string> = {
  orchestrator: '#FFD700',      // Gold
  executor: '#4A90D9',          // Blue
  explorer: '#2ECC71',          // Green
  planner: '#9B59B6',           // Purple
  architect: '#2C3E50',         // Dark Blue
  reviewer: '#E67E22',          // Orange
  debugger: '#E74C3C',          // Red
  writer: '#00BCD4',            // Cyan
  single: '#BDC3C7',            // Silver
  'build-fixer': '#F39C12',     // Amber
  'test-engineer': '#1ABC9C',   // Teal
  designer: '#E91E63',          // Pink
  'security-reviewer': '#FF5722', // Deep Orange
  scientist: '#673AB7',         // Deep Purple
  'document-specialist': '#795548', // Brown
  'code-reviewer': '#D35400',     // Dark Orange
  'quality-reviewer': '#16A085',  // Dark Teal
  'qa-tester': '#27AE60',         // Emerald
  'git-master': '#8E44AD',        // Wisteria
  'code-simplifier': '#2980B9',   // Belize Hole
  critic: '#C0392B',              // Pomegranate
  analyst: '#34495E',             // Wet Asphalt
  verifier: '#0097A7',            // Dark Cyan
  'deep-executor': '#1565C0',     // Strong Blue
};

// Agent display names
export const AGENT_NAMES: Record<AgentType, string> = {
  orchestrator: 'Tech Lead',
  executor: 'Engineer',
  explorer: 'Researcher',
  planner: 'Product Mgr',
  architect: 'Architect',
  reviewer: 'Reviewer',
  debugger: 'Debug Eng.',
  writer: 'Tech Writer',
  single: 'Contributor',
  'build-fixer': 'DevOps Eng.',
  'test-engineer': 'QA Engineer',
  designer: 'UX Designer',
  'security-reviewer': 'Security Eng.',
  scientist: 'Data Scientist',
  'document-specialist': 'Doc Lead',
  'code-reviewer': 'Sr. Reviewer',
  'quality-reviewer': 'QA Lead',
  'qa-tester': 'QA Tester',
  'git-master': 'Release Eng.',
  'code-simplifier': 'Refactor Eng.',
  critic: 'Tech Advisor',
  analyst: 'Analyst',
  verifier: 'Verifier',
  'deep-executor': 'Sr. Engineer',
};

// Animation timing (ms) - base values, multiplied by speed
export const TIMING = {
  SPAWN: 500,
  THINKING: 1500,
  MOVE_PER_TILE: 80,
  TOOL_USE: 1500,
  MESSAGE_FLIGHT: 500,
  DESPAWN: 500,
  IDLE_BOUNCE: 1000,
  MEETING_GATHER: 600,
  MEETING_DISCUSS: 3000,
  MEETING_DISPERSE: 400,
};
