import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Cache loaded skill files in memory */
const cache = new Map<string, string>();

/**
 * Load a skill markdown file for the given agent ID.
 * Returns the file content, or null if the file doesn't exist.
 */
export function loadSkill(agentId: string): string | null {
  if (cache.has(agentId)) return cache.get(agentId)!;

  try {
    const filePath = join(__dirname, `${agentId}.md`);
    const content = readFileSync(filePath, 'utf-8');
    cache.set(agentId, content);
    return content;
  } catch {
    return null;
  }
}
