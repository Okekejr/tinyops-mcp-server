import { z } from 'zod';

// Single source of truth for MCP tool input shapes. Each schema below is
// referenced by the dispatcher in tools/index.ts to safeParse incoming
// arguments before the handler runs, and re-exported as a TypeScript type via
// z.infer for the handler signatures.

const UUID = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  { message: 'must be a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' },
);

const Slug = z.string().regex(
  /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/,
  { message: 'must be a valid slug (lowercase alphanumeric and hyphens, 2-50 chars)' },
);

const Page = z.coerce.number().int().min(1).max(999);
const PageSize = z.coerce.number().int().min(1).max(50);
const YamlSource = z.string().min(1, { message: 'yaml must be a non-empty string' });

const RuleMode = z.enum(['live', 'shadow', 'disabled']);
const TriggerType = z.enum(['schedule', 'webhook', 'poll']);
const ExecutionStatus = z.enum(['success', 'failure', 'skipped', 'timeout', 'running']);

export const ListRulesSchema = z.object({
  page: Page.optional(),
  mode: RuleMode.optional(),
  triggerType: TriggerType.optional(),
}).strict();

export const GetRuleSchema = z.object({
  ruleId: UUID,
}).strict();

export const ListExecutionsSchema = z.object({
  ruleId: UUID.optional(),
  status: ExecutionStatus.optional(),
  page: Page.optional(),
  pageSize: PageSize.optional(),
}).strict();

export const GetExecutionSchema = z.object({
  executionId: UUID,
}).strict();

export const GetUsageSchema = z.object({}).strict();

export const CreateRuleSchema = z.object({
  yaml: YamlSource,
}).strict();

export const UpdateRuleSchema = z.object({
  ruleId: UUID,
  yaml: YamlSource,
}).strict();

export const PromoteRuleSchema = z.object({
  ruleId: UUID,
}).strict();

export const ValidateRuleYamlSchema = z.object({
  yaml: YamlSource,
}).strict();

export const TestRuleSchema = z.object({
  ruleId: UUID,
}).strict();

export const SetRuleModeSchema = z.object({
  ruleId: UUID,
  mode: RuleMode,
}).strict();

export const DeleteRuleSchema = z.object({
  ruleId: UUID,
  confirmationToken: z.string().min(1).optional(),
}).strict();

export const DeactivatePackSchema = z.object({
  packId: Slug,
}).strict();

export type ListRulesArgs = z.infer<typeof ListRulesSchema>;
export type GetRuleArgs = z.infer<typeof GetRuleSchema>;
export type ListExecutionsArgs = z.infer<typeof ListExecutionsSchema>;
export type GetExecutionArgs = z.infer<typeof GetExecutionSchema>;
export type GetUsageArgs = z.infer<typeof GetUsageSchema>;
export type CreateRuleArgs = z.infer<typeof CreateRuleSchema>;
export type UpdateRuleArgs = z.infer<typeof UpdateRuleSchema>;
export type PromoteRuleArgs = z.infer<typeof PromoteRuleSchema>;
export type ValidateRuleYamlArgs = z.infer<typeof ValidateRuleYamlSchema>;
export type TestRuleArgs = z.infer<typeof TestRuleSchema>;
export type SetRuleModeArgs = z.infer<typeof SetRuleModeSchema>;
export type DeleteRuleArgs = z.infer<typeof DeleteRuleSchema>;
export type DeactivatePackArgs = z.infer<typeof DeactivatePackSchema>;

// Maps tool name (the MCP-facing string) to its input schema. The dispatcher
// uses this to validate args before invoking the handler.
export const TOOL_SCHEMAS = {
  list_rules: ListRulesSchema,
  get_rule: GetRuleSchema,
  list_executions: ListExecutionsSchema,
  get_execution: GetExecutionSchema,
  get_usage: GetUsageSchema,
  create_rule: CreateRuleSchema,
  update_rule: UpdateRuleSchema,
  promote_rule: PromoteRuleSchema,
  validate_rule_yaml: ValidateRuleYamlSchema,
  test_rule: TestRuleSchema,
  set_rule_mode: SetRuleModeSchema,
  delete_rule: DeleteRuleSchema,
  deactivate_pack: DeactivatePackSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// Formats a ZodError into a single human-readable line per issue. Kept here
// so the dispatcher can return a consistent VALIDATION_FAILED message.
export function formatZodIssues(err: z.ZodError): string {
  return err.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  }).join('; ');
}
