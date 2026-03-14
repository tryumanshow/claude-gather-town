/**
 * Re-export SDK streaming message types and define content block types
 * that the SDK doesn't export granularly.
 */
export type { SDKMessage, SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';

/** Content block types for assistant/user messages (SDK doesn't export these granularly) */
export interface SDKTextBlock {
  type: 'text';
  text: string;
}

export interface SDKToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SDKToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
}

export type SDKContentBlock = SDKTextBlock | SDKToolUseBlock | SDKToolResultBlock;

/** Extract text content from an SDK assistant message */
export function extractTextFromAssistant(message: { message?: { content?: Array<{ type: string; text?: string }> } }): string | null {
  const content = message.message?.content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      return block.text;
    }
  }
  return null;
}
