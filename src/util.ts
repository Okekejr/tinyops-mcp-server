import type { TinyOpsClient } from './client.js';

export type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

// Handlers receive args already validated and shaped by the per-tool Zod
// schema in tools/schemas.ts. Each handler declares its concrete arg type,
// which the dispatcher narrows to before invocation.
export type ToolHandler<Args = unknown> = (
  args: Args,
  client: TinyOpsClient,
) => Promise<ToolResult>;

export function formatResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function formatError(code: string, message: string, hint?: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: code, message, ...(hint && { hint }) }, null, 2) }] };
}
