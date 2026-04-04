import { AGENT_ROSTER } from '@theater/shared';
import type { SimMode, RosterAgent } from '@theater/shared';
import { runSDKQuery } from '../utils/sdkQueryHelper.js';
import { pickAgentsForTask } from './pickAgents.js';

export interface BrainDecision {
  intent: 'chat' | 'work';
  /** Direct response text (only for chat intent) */
  response?: string;
  /** Selected agent id */
  agentId: string;
  /** For work: recommended mode */
  mode: SimMode;
  /** For work with subagent/teams: selected team member ids */
  teamIds?: string[];
  /** Brief plan (for work) */
  plan?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  content: string;
}

/**
 * Brain: lightweight Claude SDK call that classifies user intent,
 * picks the right agent, and generates chat responses.
 * Uses Claude Code SDK query() instead of direct API calls.
 */
export class Brain {
  private chatHistory: ChatHistoryEntry[] = [];
  private static readonly MAX_HISTORY = 20;

  /** Add a user message to the conversation history */
  addUserMessage(content: string): void {
    this.chatHistory.push({ role: 'user', content });
    this.trimHistory();
  }

  /** Add an agent response to the conversation history */
  addAgentMessage(agentId: string, agentName: string, content: string): void {
    this.chatHistory.push({ role: 'agent', agentId, agentName, content });
    this.trimHistory();
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.chatHistory = [];
  }

  private trimHistory(): void {
    if (this.chatHistory.length > Brain.MAX_HISTORY) {
      this.chatHistory = this.chatHistory.slice(-Brain.MAX_HISTORY);
    }
  }

  /** Build conversation history string — used by both Brain routing and agent session context */
  buildHistoryContext(): string {
    if (this.chatHistory.length === 0) return '';
    const lines = this.chatHistory.map(h => {
      if (h.role === 'user') return `User: ${h.content}`;
      return `${h.agentName} (${h.agentId}): ${h.content}`;
    });
    return `\n\nRecent conversation history:\n${lines.join('\n')}`;
  }

  async analyze(
    userInput: string,
    targetAgent?: string,
    explicitMode?: SimMode,
    lastChatAgentId?: string,
  ): Promise<BrainDecision> {
    const rosterSummary = AGENT_ROSTER
      .map(a => `- ${a.name} (${a.id}): ${a.role} — ${a.skills.slice(0, 4).join(', ')}`)
      .join('\n');

    const historyContext = this.buildHistoryContext();

    const prompt = `Analyze the user input and output ONLY JSON. No other text.

User input: "${userInput}"
${targetAgent ? `User-specified agent: ${targetAgent}` : ''}
${lastChatAgentId ? `Previously chatting agent: ${lastChatAgentId} — for single mode, MUST continue with this agent unless user explicitly names a different one. For subagent/teams, ignore this and pick best experts.` : ''}
${explicitMode ? `User-specified mode: ${explicitMode}` : ''}
${historyContext}

Team roster:
${rosterSummary}

JSON format:
{
  "intent": "chat" or "work",
  "agentId": "best matching agent id",
  "response": "chat only: natural Korean response reflecting conversation context, matching the agent's personality and role (1-2 sentences)",
  "mode": "single", "subagent", or "teams",
  "teamIds": ["work + subagent/teams only: array of team member ids"],
  "plan": "work only: brief execution plan"
}

Examples:
- "안녕!" → chat (greeting)
- "승우 어딨어" → chat (asking about team member)
- "뭐해?" → chat (casual)
- "오늘 날씨 어때?" → chat (small talk)
- "이 코드 리뷰해줘" → work
- "버그 좀 고쳐" → work
- "테스트 작성해줘" → work
- "이 파일 읽어봐" → work

Classification rules:
- Greetings, small talk, emotions, general knowledge questions → "chat" (respond without tools)
- Code writing/editing/analysis/debugging/file operations → "work"
- Web search, "search for", "look up", "find out about" requests → always "work"
- CRITICAL: If "Previously chatting agent" exists AND mode is "single": ALWAYS use that agent for both chat and work — unless user explicitly names a different agent. Conversation continuity is the top priority.
- For subagent/teams mode: ignore conversation continuity. Pick the best agents based on expertise for the task. Always include all relevant specialists in teamIds.
- Short confirmations like "네", "응", "yes", "ok", "좋아", "해줘", "부탁해" → check conversation history:
  - If the previous agent offered to do something (e.g., "파일을 만들어드릴까요?"), treat as "work" and use that agent
  - If it's a simple acknowledgment in casual conversation, treat as "chat"
- For chat: response MUST reference conversation history context and flow naturally
- If user specified an agent, use that agent
- If "Previously chatting agent" exists, use that agent (see CRITICAL rule above)
- Only if no previous agent and no user-specified agent: pick the agent with the most relevant expertise
- If mode is explicitly specified, use it as-is
- For work without explicit mode, recommend single/subagent based on task scope
- IMPORTANT: Always respond in Korean for the "response" field`;

    try {
      const result = await this.runSDKQueryInternal(prompt);
      if (result) {
        const parsed = this.parseDecision(result, targetAgent, explicitMode);
        if (parsed) return parsed;
      }
    } catch (err) {
      console.error('Brain analysis failed, using fallback:', err);
    }

    return this.fallback(userInput, targetAgent, explicitMode);
  }

  private runSDKQueryInternal(prompt: string): Promise<string | null> {
    return runSDKQuery({
      prompt,
      systemPromptAppend: '\n\nYou are the team Brain (router). Analyze user input and route to the appropriate agent. Output JSON only. Always write the "response" field in Korean.',
    });
  }

  private parseDecision(
    text: string,
    targetAgent?: string,
    explicitMode?: SimMode,
  ): BrainDecision | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]) as BrainDecision;

      // Validate agentId
      if (!AGENT_ROSTER.some(a => a.id === parsed.agentId)) {
        parsed.agentId = targetAgent || 'morgan';
      }
      // Validate teamIds
      if (parsed.teamIds) {
        parsed.teamIds = parsed.teamIds.filter(id => AGENT_ROSTER.some(a => a.id === id));
      }
      // Apply explicit mode override
      if (explicitMode) {
        parsed.mode = explicitMode;
        if (parsed.intent === 'chat' && (explicitMode === 'subagent' || explicitMode === 'teams')) {
          parsed.intent = 'work';
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private fallback(userInput: string, targetAgent?: string, explicitMode?: SimMode): BrainDecision {
    const mode = explicitMode || 'single';
    const picked = pickAgentsForTask(userInput, mode) as RosterAgent[];
    const agentId = targetAgent || picked[0]?.id || 'morgan';

    // Short inputs without work keywords are likely casual chat
    const workKeywords = /코드|리뷰|작성|수정|고쳐|만들|구현|파일|테스트|디버그|분석|검색|찾아|빌드|배포|설치/;
    const isLikelyChat = userInput.length < 15 && !workKeywords.test(userInput);

    if (isLikelyChat) {
      return {
        intent: 'chat',
        agentId,
        mode: 'single',
        response: '안녕하세요! 무엇을 도와드릴까요?',
      };
    }

    return {
      intent: 'work',
      agentId,
      mode,
      teamIds: mode !== 'single' ? picked.map(p => p.id) : undefined,
      plan: `${picked.map(p => p.name).join(', ')} will handle the task.`,
    };
  }
}
