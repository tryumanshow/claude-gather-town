import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface RoleFileMapping {
  rosterId: string;
  patterns: string[];
  description: string;
}

const ROLE_FILE_MAPPINGS: RoleFileMapping[] = [
  { rosterId: 'alex',   patterns: ['src/components/**', 'src/pages/**', '**/*.tsx', '**/*.css'], description: 'Frontend' },
  { rosterId: 'jordan', patterns: ['src/api/**', 'server/**', '**/*.sql', 'prisma/**', 'src/routes/**'], description: 'Backend' },
  { rosterId: 'hana',   patterns: ['src/**/*.ts', 'src/**/*.tsx'], description: 'Full-Stack' },
  { rosterId: 'taeho',  patterns: ['ios/**', 'android/**', 'mobile/**', 'app/**'], description: 'Mobile' },
  { rosterId: 'riley',  patterns: ['**/*.test.*', '**/*.spec.*', 'tests/**', '__tests__/**', 'cypress/**'], description: 'Tests' },
  { rosterId: 'yuna',   patterns: ['**/*.css', '**/*.scss', 'src/styles/**', 'public/assets/**'], description: 'Design' },
  { rosterId: 'casey',  patterns: ['data/**', 'etl/**', 'pipeline/**', 'scripts/data*'], description: 'Data' },
  { rosterId: 'seungwoo', patterns: ['ml/**', 'models/**', 'training/**', '**/*.py'], description: 'ML/AI' },
  { rosterId: 'dana',   patterns: ['.env*', 'auth/**', 'security/**', '**/middleware/auth*'], description: 'Security' },
  { rosterId: 'sam',    patterns: ['Dockerfile*', '.github/**', 'terraform/**', 'k8s/**', 'docker-compose*', '.gitlab-ci*'], description: 'DevOps' },
  { rosterId: 'minjun', patterns: ['packages/**', 'tools/**', 'scripts/**', 'sdk/**'], description: 'Platform' },
  { rosterId: 'nari',   patterns: ['**/*.md', 'docs/**', 'README*', 'CHANGELOG*'], description: 'Documentation' },
  { rosterId: 'morgan', patterns: ['**/*'], description: 'Architecture (all)' },
  { rosterId: 'sujin',  patterns: ['**/*.md', 'docs/**'], description: 'Product specs' },
];

const MAX_FILES = 100;
const MAX_DEPTH = 5;

// Compiled regex cache — each pattern is compiled once and reused across all file matching calls
const patternCache = new Map<string, { regex: RegExp; filenameOnly: boolean }>();

function getCompiledPattern(pattern: string): { regex: RegExp; filenameOnly: boolean } {
  const cached = patternCache.get(pattern);
  if (cached) return cached;

  let regexStr = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      regexStr += '.*';
      i += 2;
      if (pattern[i] === '/') i++;
    } else if (c === '*') {
      regexStr += '[^/]*';
      i++;
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if (c === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }

  try {
    const result = { regex: new RegExp(`^${regexStr}$`), filenameOnly: !pattern.includes('/') };
    patternCache.set(pattern, result);
    return result;
  } catch {
    const fallback = { regex: /(?!)/, filenameOnly: false }; // never matches
    patternCache.set(pattern, fallback);
    return fallback;
  }
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const { regex, filenameOnly } = getCompiledPattern(pattern);
  if (filenameOnly) {
    const filename = normalizedPath.split('/').pop() || '';
    return regex.test(filename);
  }
  return regex.test(normalizedPath);
}

function collectFiles(dir: string, baseDir: string, depth: number, results: string[]): void {
  if (depth > MAX_DEPTH || results.length >= MAX_FILES) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) break;
    // Skip hidden dirs and node_modules
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;

    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      collectFiles(fullPath, baseDir, depth + 1, results);
    } else if (stat.isFile()) {
      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
}

interface AwarenessResult {
  files: string[];
  summary: string;
  isEmpty: boolean;
}

export class AwarenessManager {
  private cache: Map<string, AwarenessResult> = new Map();

  async scanForAgent(rosterId: string, baseDir: string): Promise<string[]> {
    const mapping = ROLE_FILE_MAPPINGS.find(m => m.rosterId === rosterId);
    if (!mapping) return [];

    const allFiles: string[] = [];
    collectFiles(baseDir, baseDir, 0, allFiles);
    return this.matchFiles(allFiles, mapping.patterns);
  }

  // Collects files once, then matches patterns per agent — avoids redundant directory traversal
  async scanAll(baseDir: string): Promise<Map<string, string[]>> {
    const allFiles: string[] = [];
    collectFiles(baseDir, baseDir, 0, allFiles);

    const results = new Map<string, string[]>();
    for (const mapping of ROLE_FILE_MAPPINGS) {
      results.set(mapping.rosterId, this.matchFiles(allFiles, mapping.patterns));
    }
    return results;
  }

  private matchFiles(allFiles: string[], patterns: string[]): string[] {
    const matched: string[] = [];
    for (const file of allFiles) {
      if (matched.length >= MAX_FILES) break;
      for (const pattern of patterns) {
        if (matchesPattern(file, pattern)) {
          matched.push(file);
          break;
        }
      }
    }
    return matched;
  }

  getAwareness(rosterId: string): AwarenessResult {
    const cached = this.cache.get(rosterId);
    if (cached) return cached;
    return { files: [], summary: '', isEmpty: true };
  }

  async refreshAwareness(rosterId: string, baseDir: string): Promise<AwarenessResult> {
    const files = await this.scanForAgent(rosterId, baseDir);
    const isEmpty = files.length === 0;

    let summary = '';
    if (!isEmpty) {
      // Group by directory
      const dirMap = new Map<string, number>();
      for (const f of files) {
        const parts = f.split('/');
        const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
        dirMap.set(dir, (dirMap.get(dir) || 0) + 1);
      }
      const lines = Array.from(dirMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([dir, count]) => `- ${dir}/ (${count} files)`);
      summary = lines.join('\n');
    }

    const result: AwarenessResult = { files, summary, isEmpty };
    this.cache.set(rosterId, result);
    return result;
  }

  async buildSystemPromptContext(rosterId: string, baseDir?: string): Promise<string> {
    let result = this.cache.get(rosterId);

    if (!result && baseDir) {
      result = await this.refreshAwareness(rosterId, baseDir);
    }

    if (!result || result.isEmpty) {
      return 'No existing code in your area. You need to implement from scratch.';
    }

    const mapping = ROLE_FILE_MAPPINGS.find(m => m.rosterId === rosterId);
    const desc = mapping?.description || rosterId;

    return `Project structure (area: ${desc}):\n${result.summary}`;
  }
}
