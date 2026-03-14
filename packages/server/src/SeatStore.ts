import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { DetectedSeat } from './BackgroundAnalyzer.ts';

const STORE_PATH = resolve(process.cwd(), 'bg-seats.json');

export function saveSeatPositions(seats: DetectedSeat[]): void {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(seats, null, 2), 'utf-8');
  } catch (e) {
    console.warn('SeatStore: failed to save seats', e);
  }
}

export function loadSeatPositions(): DetectedSeat[] | null {
  try {
    const data = readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(data) as DetectedSeat[];
  } catch (e) {
    console.warn('SeatStore: failed to load seats', e);
    return null;
  }
}
