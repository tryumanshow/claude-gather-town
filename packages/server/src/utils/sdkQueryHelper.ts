/**
 * Shared SDK query helper — eliminates duplicated query loop pattern
 * used in Brain.ts and BackgroundAnalyzer.ts.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKAssistantMessage } from '../anthropic/sdkTypes.js';
import { extractTextFromAssistant } from '../anthropic/sdkTypes.js';

export interface SDKQueryOptions {
  prompt: string;
  model?: string;
  maxTurns?: number;
  systemPromptAppend?: string;
  timeoutMs?: number;
  allowedTools?: string[];
  /** Use bypassPermissions mode (for non-interactive queries) */
  bypassPermissions?: boolean;
}

/**
 * Run an SDK query with timeout, returning the result text or null.
 * Handles the common for-await loop pattern over SDK streaming messages.
 */
export async function runSDKQuery(options: SDKQueryOptions): Promise<string | null> {
  const {
    prompt,
    model = 'claude-sonnet-4-6',
    maxTurns = 1,
    systemPromptAppend = '',
    timeoutMs = 15000,
    allowedTools,
    bypassPermissions = false,
  } = options;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    let resultText = '';

    const queryOptions: Record<string, unknown> = {
      model,
      maxTurns,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: systemPromptAppend,
      },
      abortController,
      persistSession: false,
      includePartialMessages: false,
    };

    if (allowedTools) {
      queryOptions.allowedTools = allowedTools;
    } else {
      queryOptions.tools = [] as string[];
    }

    if (bypassPermissions) {
      queryOptions.permissionMode = 'bypassPermissions';
      queryOptions.allowDangerouslySkipPermissions = true;
    }

    const q = query({
      prompt,
      options: queryOptions,
    } as Parameters<typeof query>[0]);

    for await (const message of q) {
      if (message.type === 'result' && message.subtype === 'success' && message.result) {
        resultText = message.result;
      } else if (message.type === 'assistant') {
        const text = extractTextFromAssistant(message as SDKAssistantMessage);
        if (text) resultText = text;
      }
    }

    return resultText || null;
  } finally {
    clearTimeout(timeout);
  }
}
