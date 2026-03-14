import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { RepoStatusPayload } from '@theater/shared';

const STATE_FILE = '.theater-state.json';

interface TheaterState {
  lastKnownHash: string | null;
}

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
  '.cs', '.rb', '.php', '.swift', '.kt', '.vue', '.svelte',
  '.css', '.scss', '.html', '.json', '.yaml', '.yml', '.toml',
  '.md', '.sql', '.sh', '.dockerfile',
]);

function hasSourceFiles(dir: string, depth = 0): boolean {
  if (depth > 3) return false;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          const ext = entry.includes('.') ? '.' + entry.split('.').pop()!.toLowerCase() : '';
          if (SOURCE_EXTENSIONS.has(ext)) return true;
        } else if (stat.isDirectory()) {
          if (hasSourceFiles(fullPath, depth + 1)) return true;
        }
      } catch {
        // skip unreadable
      }
    }
  } catch {
    // skip unreadable dir
  }
  return false;
}

export class RepoManager {
  workingDirectory: string | null = null;
  private _userConfigured = false;

  setWorkingDirectory(path: string): { valid: boolean; error?: string } {
    if (!existsSync(path)) {
      return { valid: false, error: `Path does not exist: ${path}` };
    }
    this.workingDirectory = path;
    this._userConfigured = true;
    return { valid: true };
  }

  setScratch(): void {
    this.workingDirectory = null;
    this._userConfigured = true;
  }

  getStatus(): RepoStatusPayload {
    const path = this.workingDirectory;
    if (!path) {
      return {
        path: null,
        name: '',
        isGitRepo: false,
        fromScratch: this._userConfigured, // true only after user explicitly chose scratch
      };
    }

    const name = basename(path);
    let isGitRepo = false;
    let currentBranch: string | undefined;
    let hasChanges: boolean | undefined;
    let diffSummary: string | undefined;
    let changedFiles: string[] | undefined;

    try {
      execSync('git rev-parse --git-dir', { cwd: path, stdio: 'pipe' });
      isGitRepo = true;
    } catch {
      // not a git repo
    }

    if (isGitRepo) {
      try {
        currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: path, stdio: 'pipe' })
          .toString()
          .trim();
      } catch {
        currentBranch = undefined;
      }

      try {
        const status = execSync('git status --porcelain', { cwd: path, stdio: 'pipe' })
          .toString()
          .trim();
        hasChanges = status.length > 0;
        if (hasChanges) {
          changedFiles = status
            .split('\n')
            .filter(l => l.trim())
            .map(l => l.slice(3).trim());
        } else {
          changedFiles = [];
        }
      } catch {
        hasChanges = false;
        changedFiles = [];
      }

      try {
        diffSummary = execSync('git diff --stat HEAD', { cwd: path, stdio: 'pipe' })
          .toString()
          .trim();
        if (!diffSummary) {
          diffSummary = undefined;
        }
      } catch {
        diffSummary = undefined;
      }
    }

    const fromScratch = !hasSourceFiles(path);

    return {
      path,
      name,
      isGitRepo,
      currentBranch,
      hasChanges,
      diffSummary,
      changedFiles,
      fromScratch,
    };
  }

  detectChanges(): { hasNewChanges: boolean; currentHash: string | null } {
    const path = this.workingDirectory;
    if (!path) return { hasNewChanges: false, currentHash: null };

    let currentHash: string | null = null;
    try {
      currentHash = execSync('git rev-parse HEAD', { cwd: path, stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      return { hasNewChanges: false, currentHash: null };
    }

    const stateFile = join(path, STATE_FILE);
    let lastKnownHash: string | null = null;
    try {
      const raw = readFileSync(stateFile, 'utf8');
      const state: TheaterState = JSON.parse(raw);
      lastKnownHash = state.lastKnownHash;
    } catch {
      // no state file yet
    }

    const hasNewChanges = currentHash !== lastKnownHash;

    // Persist current hash
    try {
      const state: TheaterState = { lastKnownHash: currentHash };
      writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch {
      // ignore write errors
    }

    return { hasNewChanges, currentHash };
  }
}
