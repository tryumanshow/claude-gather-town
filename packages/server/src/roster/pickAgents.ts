import type { SimMode } from '@theater/shared';
import { AGENT_ROSTER, type RosterAgent } from '@theater/shared';

/**
 * Pick the most relevant roster agents for a given task description.
 * Uses keyword matching against each agent's skills array.
 */
export function pickAgentsForTask(
  description: string,
  mode: SimMode,
  roster: RosterAgent[] = AGENT_ROSTER,
): RosterAgent[] {
  const desc = description.toLowerCase();

  // Score each agent by keyword hits
  const scored = roster.map(agent => {
    let score = 0;
    for (const skill of agent.skills) {
      if (desc.includes(skill.toLowerCase())) {
        score += 1;
      }
    }
    return { agent, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Determine how many agents to pick based on mode
  let count: number;
  switch (mode) {
    case 'single':
      count = 1;
      break;
    case 'subagent':
      count = 3;
      break;
    case 'teams':
      count = Math.min(5, roster.length);
      break;
    default:
      count = 1;
  }

  // Pick top scorers; if nobody matched, fallback to Morgan (tech lead) + others
  const picked = scored.slice(0, count);

  // Ensure at least one agent is selected
  if (picked.length === 0 || picked.every(p => p.score === 0)) {
    // Default: Morgan (tech lead) first, then fill
    const morgan = roster.find(a => a.id === 'morgan');
    if (morgan) {
      const result = [morgan];
      for (const a of roster) {
        if (a.id !== 'morgan' && result.length < count) {
          result.push(a);
        }
      }
      return result.slice(0, count);
    }
  }

  return picked.map(p => p.agent).slice(0, count);
}
