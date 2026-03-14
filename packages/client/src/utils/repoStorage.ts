export const REPO_STORAGE_KEY = 'theater:recent-repos';

export function loadRecentRepos(): string[] {
  try {
    const raw = localStorage.getItem(REPO_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function saveRecentRepo(path: string): void {
  const existing = loadRecentRepos().filter(p => p !== path);
  localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify([path, ...existing].slice(0, 10)));
}
