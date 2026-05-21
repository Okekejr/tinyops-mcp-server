import type { TinyOpsClient } from './client.js';

export type ToolHandler = (
  args: Record<string, unknown>,
  client: TinyOpsClient,
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

export function formatResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function formatError(code: string, message: string, hint?: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: code, message, ...(hint && { hint }) }, null, 2) }] };
}
