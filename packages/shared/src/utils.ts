import { ZONES, TILE_SIZE } from './constants.js';

export function getZoneCenter(zoneName: string): { x: number; y: number } {
  const zone = ZONES.find(z => z.name === zoneName);
  if (!zone) return { x: 500, y: 400 };
  return {
    x: (zone.x + zone.width / 2) * TILE_SIZE,
    y: (zone.y + zone.height / 2) * TILE_SIZE,
  };
}
