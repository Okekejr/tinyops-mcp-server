import type { TinyOpsClient } from '../client.js';
import type { ToolHandler } from '../util.js';
import { formatResult } from '../util.js';
import type {
  ListRulesArgs,
  GetRuleArgs,
  ListExecutionsArgs,
  GetExecutionArgs,
  GetUsageArgs,
  CreateRuleArgs,
  UpdateRuleArgs,
  PromoteRuleArgs,
  ValidateRuleYamlArgs,
  TestRuleArgs,
  SetRuleModeArgs,
  DeleteRuleArgs,
  DeactivatePackArgs,
} from './schemas.js';

export const listRules: ToolHandler<ListRulesArgs> = async (args, client) => {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set('page', String(args.page));
  if (args.mode) params.set('mode', args.mode);
  if (args.triggerType) params.set('triggerType', args.triggerType);
  const rules = await client.get(`/api/mcp/rules?${params}`);
  return formatResult(rules);
};

export const getRule: ToolHandler<GetRuleArgs> = async (args, client) => {
  const rule = await client.get(`/api/mcp/rules/${args.ruleId}`);
  return formatResult(rule);
};

export const listExecutions: ToolHandler<ListExecutionsArgs> = async (args, client) => {
  const params = new URLSearchParams();
  if (args.ruleId) params.set('ruleId', args.ruleId);
  if (args.status) params.set('status', args.status);
  if (args.page !== undefined) params.set('page', String(args.page));
  if (args.pageSize !== undefined) params.set('pageSize', String(args.pageSize));
  return formatResult(await client.get(`/api/mcp/executions?${params}`));
};

export const getExecution: ToolHandler<GetExecutionArgs> = async (args, client) => {
  return formatResult(await client.get(`/api/mcp/executions/${args.executionId}`));
};

export const getUsage: ToolHandler<GetUsageArgs> = async (_args, client) => {
  return formatResult(await client.get('/api/mcp/usage'));
};

export const createRule: ToolHandler<CreateRuleArgs> = async (args, client) => {
  const result = await client.post('/api/mcp/rules', { yaml: args.yaml });
  return formatResult({
    ...result as object,
    note: 'Rule created in SHADOW mode. Use promote_rule to move it to live after verifying with test_rule.',
  });
};

export const updateRule: ToolHandler<UpdateRuleArgs> = async (args, client) => {
  const result = await client.post(`/api/mcp/rules/${args.ruleId}/update`, { yaml: args.yaml });
  return formatResult(result);
};

export const promoteRule: ToolHandler<PromoteRuleArgs> = async (args, client) => {
  const result = await client.post(`/api/mcp/rules/${args.ruleId}/promote`);
  return formatResult(result);
};

export const validateRuleYaml: ToolHandler<ValidateRuleYamlArgs> = async (args, client) => {
  return formatResult(await client.post('/api/mcp/rules/validate', { yaml: args.yaml }));
};

export const testRule: ToolHandler<TestRuleArgs> = async (args, client) => {
  return formatResult(await client.post(`/api/mcp/rules/${args.ruleId}/test`));
};

export const setRuleMode: ToolHandler<SetRuleModeArgs> = async (args, client) => {
  const result = await client.post(`/api/mcp/rules/${args.ruleId}/mode`, { mode: args.mode });
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

export const deactivatePack: ToolHandler<DeactivatePackArgs> = async (args, client) => {
  const result = await client.post<DeactivatePackResponse>(`/api/packs/${args.packId}/deactivate`);

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

export const deleteRule: ToolHandler<DeleteRuleArgs> = async (args, client) => {
  if (!args.confirmationToken) {
    const token = await client.post<{ token: string; expiresInSeconds: number; rule: unknown }>('/api/mcp/rules/delete-confirm', { ruleId: args.ruleId });
    return formatResult({
      status: 'confirmation_required',
      confirmationToken: token.token,
      expiresInSeconds: token.expiresInSeconds,
      rule: token.rule,
      message: `Confirm deletion by calling delete_rule again with this confirmationToken. Expires in ${token.expiresInSeconds}s.`,
    });
  }
  const result = await client.post('/api/mcp/rules/delete', { ruleId: args.ruleId, confirmationToken: args.confirmationToken });
  return formatResult(result);
};
