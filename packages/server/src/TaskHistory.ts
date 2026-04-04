import { readFileSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface TaskHistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  agentId: string;
  agentName: string;
  mode: 'single' | 'subagent' | 'teams';
  status: 'completed' | 'failed';
  summary?: string;
}

const HISTORY_DIR = '.claude-gather-town';
const HISTORY_FILE = 'task-history.json';
const MAX_ENTRIES = 100;

export class TaskHistory {
  private entries: TaskHistoryEntry[] = [];
  private historyPath: string;

  constructor(workingDirectory: string) {
    try {
      const dir = join(workingDirectory, HISTORY_DIR);
      mkdirSync(dir, { recursive: true });
      this.historyPath = join(dir, HISTORY_FILE);
      this.load();
    } catch {
      this.historyPath = '';
    }
  }

  private load(): void {
    if (!this.historyPath) return;
    try {
      const data = readFileSync(this.historyPath, 'utf-8');
      this.entries = JSON.parse(data);
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    if (!this.historyPath) return;
    writeFile(this.historyPath, JSON.stringify(this.entries, null, 2)).catch(err => {
      console.error('[TaskHistory] Save failed:', err);
    });
  }

  add(entry: TaskHistoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    this.save();
  }

  getRecent(count = 10): TaskHistoryEntry[] {
    return this.entries.slice(-count);
  }

  buildContext(count = 5): string {
    const recent = this.getRecent(count);
    if (recent.length === 0) return '';
    const lines = recent.map(e => {
      const date = new Date(e.timestamp).toLocaleDateString('ko-KR');
      return `- [${date}] ${e.agentName} (${e.mode}): ${e.description}${e.summary ? ' → ' + e.summary : ''}`;
    });
    return `\n\nRecent task history:\n${lines.join('\n')}`;
  }

  updateWorkingDirectory(path: string): void {
    try {
      const dir = join(path, HISTORY_DIR);
      mkdirSync(dir, { recursive: true });
      this.historyPath = join(dir, HISTORY_FILE);
      this.load();
    } catch {
      this.historyPath = '';
    }
  }
}
