import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { TinyOpsClient } from '../client.js';
import { McpToolError } from '../client.js';
import type { ToolHandler } from '../util.js';
import * as handlers from './handlers.js';
import { TOOL_SCHEMAS, formatZodIssues, type ToolName } from './schemas.js';

const TOOL_DEFINITIONS = [
  {
    name: 'list_rules',
    description: 'List automation rules in your TinyOps organization (paginated, 20 per page). Returns name, mode (live/shadow/disabled), trigger type, last run status, run count, source, and shadow progress for shadow-mode rules.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'integer', minimum: 1, maximum: 999, description: 'Page number, 1-999 (default: 1)' },
        mode: { type: 'string', enum: ['live', 'shadow', 'disabled'], description: 'Filter by rule mode' },
        triggerType: { type: 'string', enum: ['schedule', 'webhook', 'poll'], description: 'Filter by trigger type' },
      },
    },
  },
  {
    name: 'get_rule',
    description: 'Get full details of a single rule including its YAML source, parsed conditions, actions, schedule guards, and execution history summary.',
    inputSchema: {
      type: 'object' as const,
      properties: { ruleId: { type: 'string', description: 'The rule UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' } },
      required: ['ruleId'],
    },
  },
  {
    name: 'list_executions',
    description: 'Query execution history. Shows when rules fired, whether conditions passed, action results, and any errors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ruleId: { type: 'string', description: 'Filter by rule UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' },
        status: { type: 'string', enum: ['success', 'failure', 'skipped', 'timeout', 'running'], description: 'Filter by status' },
        page: { type: 'integer', minimum: 1, maximum: 999, description: 'Page number, 1-999 (default: 1)' },
        pageSize: { type: 'integer', minimum: 1, maximum: 50, description: 'Results per page, 1-50 (default: 20)' },
      },
    },
  },
  {
    name: 'get_execution',
    description: 'Get full details of a single execution including trigger data, condition evaluation result, action output, duration, and any error messages.',
    inputSchema: {
      type: 'object' as const,
      properties: { executionId: { type: 'string', description: 'The execution UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_executions to find valid IDs.' } },
      required: ['executionId'],
    },
  },
  {
    name: 'get_usage',
    description: 'Get current usage statistics vs plan limits. Shows rules count, executions today, integrations connected, remaining capacity.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_rule',
    description: 'Create a new automation rule from YAML. Rules created via MCP always start in SHADOW mode. Use promote_rule to move to live after testing. Read tinyops://rule-templates for examples.',
    inputSchema: {
      type: 'object' as const,
      properties: { yaml: { type: 'string', description: 'The rule YAML source. Max 10KB.' } },
      required: ['yaml'],
    },
  },
  {
    name: 'update_rule',
    description: 'Update an existing rule with new YAML. Preserves the rule ID, execution history, and shadow run counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ruleId: { type: 'string', description: 'The rule UUID to update (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' },
        yaml: { type: 'string', description: 'The updated rule YAML source' },
      },
      required: ['ruleId', 'yaml'],
    },
  },
  {
    name: 'promote_rule',
    description: 'Promote a rule from shadow mode to live. The rule will start executing real actions on the next trigger.',
    inputSchema: {
      type: 'object' as const,
      properties: { ruleId: { type: 'string', description: 'The rule UUID to promote (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' } },
      required: ['ruleId'],
    },
  },
  {
    name: 'validate_rule_yaml',
    description: 'Validate rule YAML syntax and structure without creating the rule. Use before create_rule to catch issues.',
    inputSchema: {
      type: 'object' as const,
      properties: { yaml: { type: 'string', description: 'The rule YAML to validate' } },
      required: ['yaml'],
    },
  },
  {
    name: 'test_rule',
    description: 'Dry-run an existing rule: evaluate its conditions against current data without executing the action.',
    inputSchema: {
      type: 'object' as const,
      properties: { ruleId: { type: 'string', description: 'The rule UUID to test (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' } },
      required: ['ruleId'],
    },
  },
  {
    name: 'set_rule_mode',
    description: 'Change a rule mode to shadow, disabled, or live. Use to pause a live rule or re-enable a disabled one.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ruleId: { type: 'string', description: 'The rule UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' },
        mode: { type: 'string', enum: ['live', 'shadow', 'disabled'], description: 'Target mode' },
      },
      required: ['ruleId', 'mode'],
    },
  },
  {
    name: 'delete_rule',
    description: 'Delete an automation rule. Requires two calls: first without confirmationToken (returns token), then with confirmationToken to confirm. Token expires in 5 minutes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ruleId: { type: 'string', description: 'The rule UUID to delete (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890). Use list_rules to find valid IDs.' },
        confirmationToken: { type: 'string', description: 'Confirmation token from the first call. Omit on first call.' },
      },
      required: ['ruleId'],
    },
  },
  {
    name: 'deactivate_pack',
    description: 'Deactivate an automation pack, removing all its rules and stopping monitoring. This is a destructive action that cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        packId: { type: 'string', description: 'The pack slug (e.g., pr-health, cost-guard, deploy-safety)' },
      },
      required: ['packId'],
    },
  },
];

// Handlers are typed against their specific arg shape via tools/schemas.ts.
// The dispatcher narrows the validated args before invocation, so we can keep
// the registry as ToolHandler<unknown> here without losing safety upstream.
const toolHandlers = new Map<ToolName, ToolHandler<never>>([
  ['list_rules', handlers.listRules as ToolHandler<never>],
  ['get_rule', handlers.getRule as ToolHandler<never>],
  ['list_executions', handlers.listExecutions as ToolHandler<never>],
  ['get_execution', handlers.getExecution as ToolHandler<never>],
  ['get_usage', handlers.getUsage as ToolHandler<never>],
  ['create_rule', handlers.createRule as ToolHandler<never>],
  ['update_rule', handlers.updateRule as ToolHandler<never>],
  ['promote_rule', handlers.promoteRule as ToolHandler<never>],
  ['set_rule_mode', handlers.setRuleMode as ToolHandler<never>],
  ['validate_rule_yaml', handlers.validateRuleYaml as ToolHandler<never>],
  ['test_rule', handlers.testRule as ToolHandler<never>],
  ['delete_rule', handlers.deleteRule as ToolHandler<never>],
  ['deactivate_pack', handlers.deactivatePack as ToolHandler<never>],
]);

export function registerTools(server: Server, client: TinyOpsClient) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers.get(name as ToolName);
    const schema = TOOL_SCHEMAS[name as ToolName];
    if (!handler || !schema) {
      return { isError: true, content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }] };
    }

    const parsed = schema.safeParse(args ?? {});
    if (!parsed.success) {
      const err = new McpToolError(
        'VALIDATION_FAILED',
        `Invalid arguments for ${name}: ${formatZodIssues(parsed.error)}`,
        400,
        { toolName: name, issues: parsed.error.issues },
      );
      return err.toMcpContent();
    }

    try {
      return await handler(parsed.data as never, client);
    } catch (err) {
      if (err instanceof McpToolError) return err.toMcpContent();
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: 'INTERNAL_ERROR', message: String(err) }) }] };
    }
  });
}
