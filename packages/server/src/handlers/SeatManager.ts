import { resolve, dirname } from 'path';
import { writeFileSync } from 'fs';
import { WebSocket } from 'ws';
import type { ServerMessage, ZoneName } from '@theater/shared';
import { getRosterAgent, toRosterId } from '@theater/shared';
import { saveSeatPositions, loadSeatPositions } from '../SeatStore.js';
import type { DetectedSeat } from '../BackgroundAnalyzer.js';
import type { BackgroundAnalyzer } from '../BackgroundAnalyzer.js';
import type { SimulationEngine } from '../SimulationEngine.js';

let cachedSeatPositions = loadSeatPositions();

/** Resolve zone name for a seat's roster agent */
function seatZone(rosterId: string): ZoneName {
  return (getRosterAgent(rosterId)?.homeZone ?? 'spawn') as ZoneName;
}

/** Apply saved seats to WorldState on startup (call once). */
export function applySavedSeatsToWorld(simulation: SimulationEngine): void {
  const savedSeats = cachedSeatPositions;
  if (savedSeats && savedSeats.length > 0) {
    console.log(`Loaded ${savedSeats.length} saved seat positions`);
    for (const seat of savedSeats) {
      const agentId = toRosterId(seat.rosterId);
      const zoneName = seatZone(seat.rosterId);
      simulation.world.updateAgent(agentId, { x: seat.worldX, y: seat.worldY, currentZone: zoneName });
      simulation.world.setHomeSeat(agentId, seat.worldX, seat.worldY);
    }
  }
}

/** Send cached seat positions to a newly connected client. */
export function sendSavedSeats(ws: WebSocket): void {
  if (cachedSeatPositions && cachedSeatPositions.length > 0) {
    for (const seat of cachedSeatPositions) {
      const agentId = toRosterId(seat.rosterId);
      const zoneName = seatZone(seat.rosterId);
      ws.send(JSON.stringify({
        type: 'agent:move',
        payload: { agentId, targetX: seat.worldX, targetY: seat.worldY, targetZone: zoneName, path: [] },
      } as ServerMessage));
    }
  }
}

/** Handle bg:analyze message. */
export function handleBgAnalyze(
  broadcast: (msg: ServerMessage) => void,
  simulation: SimulationEngine,
  bgAnalyzer: BackgroundAnalyzer,
  srcDir: string,
  payload: { imageData: string; imageWidth: number; imageHeight: number; force?: boolean },
): void {
  const { imageData, imageWidth, imageHeight, force } = payload;

  // Save image to disk on force-analyze
  if (force && imageData) {
    try {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      writeFileSync(resolve(srcDir, '../bg-current.png'), Buffer.from(base64Data, 'base64'));
      console.log('[BgAnalyze] Background image saved: packages/server/bg-current.png');
    } catch (e) { console.warn('[BgAnalyze] Image save failed:', e); }
  }

  // If seats already saved and not forced, skip API call
  if (!force) {
    if (cachedSeatPositions && cachedSeatPositions.length > 0) {
      broadcast({
        type: 'sim:log',
        payload: { timestamp: Date.now(), level: 'info', source: 'BackgroundAnalyzer', message: `Using ${cachedSeatPositions.length} saved seats (skipping re-analysis)` },
      });
      for (const seat of cachedSeatPositions) {
        const agentId = toRosterId(seat.rosterId);
        const zoneName = seatZone(seat.rosterId);
        simulation.world.updateAgent(agentId, { x: seat.worldX, y: seat.worldY, currentZone: zoneName });
        broadcast({ type: 'agent:move', payload: { agentId, targetX: seat.worldX, targetY: seat.worldY, targetZone: zoneName, path: [] } });
      }
      return;
    }
  }

  broadcast({
    type: 'sim:log',
    payload: { timestamp: Date.now(), level: 'info', source: 'BackgroundAnalyzer', message: 'Analyzing background image... detecting seat positions.' },
  });

  const bgLogFn = (msg: string) => broadcast({
    type: 'sim:log',
    payload: { timestamp: Date.now(), level: 'info', source: 'BackgroundAnalyzer', message: msg },
  });

  bgAnalyzer.analyze(imageData, imageWidth, imageHeight, bgLogFn).then(seats => {
    broadcast({
      type: 'sim:log',
      payload: { timestamp: Date.now(), level: 'info', source: 'BackgroundAnalyzer', message: `Parsed ${seats.length} seats (rosters: ${seats.map(s=>s.rosterId).join(', ') || 'none'})` },
    });
    if (seats.length === 0) {
      broadcast({
        type: 'sim:log',
        payload: { timestamp: Date.now(), level: 'warn', source: 'BackgroundAnalyzer', message: 'No seats detected.' },
      });
      return;
    }

    broadcast({
      type: 'sim:log',
      payload: { timestamp: Date.now(), level: 'info', source: 'BackgroundAnalyzer', message: `${seats.length} seats detected! Placing agents.` },
    });

    for (const seat of seats) {
      const agentId = toRosterId(seat.rosterId);
      const zoneName = seatZone(seat.rosterId);

      simulation.world.updateAgent(agentId, { x: seat.worldX, y: seat.worldY, currentZone: zoneName });
      simulation.world.setHomeSeat(agentId, seat.worldX, seat.worldY);

      broadcast({
        type: 'agent:move',
        payload: { agentId, targetX: seat.worldX, targetY: seat.worldY, targetZone: zoneName, path: [] },
      });

      if (seat.label) {
        broadcast({
          type: 'agent:chat',
          payload: { agentId, text: `Seat confirmed! (${seat.label})`, duration: 2000 },
        });
      }
    }
    saveSeatPositions(seats);
    cachedSeatPositions = seats;
  }).catch(err => {
    broadcast({
      type: 'sim:log',
      payload: { timestamp: Date.now(), level: 'error', source: 'BackgroundAnalyzer', message: `Analysis failed: ${err}` },
    });
  });
}
