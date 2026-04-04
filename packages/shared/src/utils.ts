import { ZONES, TILE_SIZE } from './constants.js';
import type { RosterAgent } from './agentRoster.js';
import { AGENT_ROSTER } from './agentRoster.js';

// ── Roster ID helpers ──
export const ROSTER_PREFIX = 'roster-';
export const toRosterId = (id: string): string => `${ROSTER_PREFIX}${id}`;
export const fromRosterId = (rosterId: string): string =>
  rosterId.startsWith(ROSTER_PREFIX) ? rosterId.slice(ROSTER_PREFIX.length) : rosterId;
export const isRosterId = (id: string): boolean => id.startsWith(ROSTER_PREFIX);

// ── Roster lookup (O(1) via Map) ──
const rosterById = new Map<string, RosterAgent>(AGENT_ROSTER.map(a => [a.id, a]));
const rosterByRosterId = new Map<string, RosterAgent>(AGENT_ROSTER.map(a => [toRosterId(a.id), a]));

/** Lookup a roster agent by short id (e.g. 'morgan') */
export const getRosterAgent = (id: string): RosterAgent | undefined => rosterById.get(id);
/** Lookup a roster agent by full roster id (e.g. 'roster-morgan') */
export const getRosterAgentByRosterId = (rosterId: string): RosterAgent | undefined => rosterByRosterId.get(rosterId);

// ── Error helper ──
export const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export function getZoneCenter(zoneName: string): { x: number; y: number } {
  const zone = ZONES.find(z => z.name === zoneName);
  if (!zone) return { x: 500, y: 400 };
  return {
    x: (zone.x + zone.width / 2) * TILE_SIZE,
    y: (zone.y + zone.height / 2) * TILE_SIZE,
  };
}
