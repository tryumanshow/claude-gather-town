import type { AuthStatusPayload } from '@theater/shared';

export const AUTH_STORAGE_KEY = 'theater:auth';

export function loadSavedAuth(): AuthStatusPayload | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthStatusPayload;
  } catch { return null; }
}

export function saveAuth(status: AuthStatusPayload): void {
  try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(status)); } catch (err) { console.warn('Failed to persist auth:', err); }
}
