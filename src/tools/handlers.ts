import { McpToolError, type TinyOpsClient } from '../client.js';
import type { ToolHandler } from '../util.js';
import { formatResult } from '../util.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;

function requireUUID(value: unknown, paramName: string): string {
  const str = String(value ?? '');
  if (!UUID_RE.test(str)) {
    throw new McpToolError(
      'VALIDATION_FAILED',
      `${paramName} must be a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Got: '${str.slice(0, 50)}'`,
      400,
      { paramName, expectedFormat: 'UUID v4', suggestedNextTool: paramName === 'executionId' ? 'list_executions' : 'list_rules' },
    );
  }
  return str;
}

function requireSlug(value: unknown, paramName: string): string {
  const str = String(value ?? '');
  if (!SLUG_RE.test(str)) {
    throw new McpToolError(
      'VALIDATION_FAILED',
      `${paramName} must be a valid slug (lowercase alphanumeric + hyphens, 2-50 chars). Got: '${str.slice(0, 50)}'`,
      400,
      { paramName, expectedFormat: 'slug' },
    );
  }
  return str;
}

export const listRules: ToolHandler = async (args, client) => {
  const params = new URLSearchParams();
  if (args.page) params.set('page', String(args.page));
  if (args.mode) params.set('mode', String(args.mode));
  if (args.triggerType) params.set('triggerType', String(args.triggerType));
  const rules = await client.get(`/api/mcp/rules?${params}`);
  return formatResult(rules);
};

export const getRule: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  const rule = await client.get(`/api/mcp/rules/${ruleId}`);
  return formatResult(rule);
};

export const listExecutions: ToolHandler = async (args, client) => {
  const params = new URLSearchParams();
  if (args.ruleId) params.set('ruleId', requireUUID(args.ruleId, 'ruleId'));
  if (args.status) params.set('status', String(args.status));
  if (args.page) params.set('page', String(args.page));
  if (args.pageSize) params.set('pageSize', String(args.pageSize));
  return formatResult(await client.get(`/api/mcp/executions?${params}`));
};

export const getExecution: ToolHandler = async (args, client) => {
  const executionId = requireUUID(args.executionId, 'executionId');
  return formatResult(await client.get(`/api/mcp/executions/${executionId}`));
};

export const getUsage: ToolHandler = async (_args, client) => {
  return formatResult(await client.get('/api/mcp/usage'));
};

export const createRule: ToolHandler = async (args, client) => {
  const result = await client.post('/api/mcp/rules', { yaml: args.yaml });
  return formatResult({
    ...result as object,
    note: 'Rule created in SHADOW mode. Use promote_rule to move it to live after verifying with test_rule.',
  });
};

export const updateRule: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  const result = await client.post(`/api/mcp/rules/${ruleId}/update`, { yaml: args.yaml });
  return formatResult(result);
};

export const promoteRule: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  const result = await client.post(`/api/mcp/rules/${ruleId}/promote`);
  return formatResult(result);
};

export const validateRuleYaml: ToolHandler = async (args, client) => {
  return formatResult(await client.post('/api/mcp/rules/validate', { yaml: args.yaml }));
};

export const testRule: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  return formatResult(await client.post(`/api/mcp/rules/${ruleId}/test`));
};

export const setRuleMode: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  const result = await client.post(`/api/mcp/rules/${ruleId}/mode`, { mode: args.mode });
  return formatResult(result);
};

interface DeactivatePackResponse {
  deleted: number;
  deactivation?: {
    total: number;
    succeeded: number;
    failed: number;
    abortedByDeadline: number;
  };
}

export const deactivatePack: ToolHandler = async (args, client) => {
  const packId = requireSlug(args.packId, 'packId');
  const result = await client.post<DeactivatePackResponse>(`/api/packs/${packId}/deactivate`);

  const deactivation = result.deactivation;
  if (deactivation && deactivation.failed > 0) {
    return formatResult({
      status: 'partial_success',
      message: `Pack deactivated: ${result.deleted} rules removed. ${deactivation.failed} background cleanup tasks are still completing (no user action needed).`,
      deleted: result.deleted,
      deactivation,
    });
  }

  return formatResult({
    status: 'success',
    message: `Pack deactivated successfully. ${result.deleted} rules removed.`,
    deleted: result.deleted,
  });
};

export const deleteRule: ToolHandler = async (args, client) => {
  const ruleId = requireUUID(args.ruleId, 'ruleId');
  if (!args.confirmationToken) {
    const token = await client.post<{ token: string; expiresInSeconds: number; rule: unknown }>('/api/mcp/rules/delete-confirm', { ruleId });
    return formatResult({
      status: 'confirmation_required',
      confirmationToken: token.token,
      expiresInSeconds: token.expiresInSeconds,
      rule: token.rule,
      message: `Confirm deletion by calling delete_rule again with this confirmationToken. Expires in ${token.expiresInSeconds}s.`,
    });
  }
  const result = await client.post('/api/mcp/rules/delete', { ruleId, confirmationToken: args.confirmationToken });
  return formatResult(result);
};
