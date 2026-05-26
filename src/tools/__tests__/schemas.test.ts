import { describe, it, expect } from 'vitest';
import {
  ListRulesSchema,
  GetRuleSchema,
  ListExecutionsSchema,
  CreateRuleSchema,
  SetRuleModeSchema,
  DeleteRuleSchema,
  DeactivatePackSchema,
  TOOL_SCHEMAS,
  formatZodIssues,
} from '../schemas.js';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('TOOL_SCHEMAS registry', () => {
  it('covers all 13 tool names', () => {
    expect(Object.keys(TOOL_SCHEMAS)).toHaveLength(13);
  });
});

describe('ListRulesSchema', () => {
  it('accepts empty input', () => {
    expect(ListRulesSchema.parse({})).toEqual({});
  });

  it('accepts a valid mode and page', () => {
    expect(ListRulesSchema.parse({ page: 1, mode: 'live' })).toEqual({ page: 1, mode: 'live' });
  });

  it('coerces a numeric string page', () => {
    expect(ListRulesSchema.parse({ page: '3' })).toEqual({ page: 3 });
  });

  it('rejects an invalid mode', () => {
    expect(ListRulesSchema.safeParse({ mode: 'paused' }).success).toBe(false);
  });

  it('rejects page below the lower bound', () => {
    expect(ListRulesSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects page above the upper bound', () => {
    expect(ListRulesSchema.safeParse({ page: 1000 }).success).toBe(false);
  });

  it('rejects unknown keys in strict mode', () => {
    expect(ListRulesSchema.safeParse({ unknownKey: true }).success).toBe(false);
  });
});

describe('GetRuleSchema', () => {
  it('accepts a valid UUID', () => {
    expect(GetRuleSchema.parse({ ruleId: VALID_UUID })).toEqual({ ruleId: VALID_UUID });
  });

  it('rejects a missing ruleId', () => {
    expect(GetRuleSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-UUID string', () => {
    expect(GetRuleSchema.safeParse({ ruleId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('ListExecutionsSchema', () => {
  it('accepts pageSize up to 50', () => {
    expect(ListExecutionsSchema.parse({ pageSize: 50 })).toEqual({ pageSize: 50 });
  });

  it('rejects pageSize above 50', () => {
    expect(ListExecutionsSchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it('rejects an invalid execution status', () => {
    expect(ListExecutionsSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });
});

describe('CreateRuleSchema', () => {
  it('accepts a non-empty yaml string', () => {
    expect(CreateRuleSchema.parse({ yaml: 'name: foo' })).toEqual({ yaml: 'name: foo' });
  });

  it('rejects an empty yaml string', () => {
    expect(CreateRuleSchema.safeParse({ yaml: '' }).success).toBe(false);
  });

  it('rejects a missing yaml field', () => {
    expect(CreateRuleSchema.safeParse({}).success).toBe(false);
  });
});

describe('SetRuleModeSchema', () => {
  it('accepts every valid mode', () => {
    for (const mode of ['live', 'shadow', 'disabled'] as const) {
      expect(SetRuleModeSchema.parse({ ruleId: VALID_UUID, mode })).toEqual({ ruleId: VALID_UUID, mode });
    }
  });

  it('rejects an invalid mode', () => {
    expect(SetRuleModeSchema.safeParse({ ruleId: VALID_UUID, mode: 'paused' }).success).toBe(false);
  });
});

describe('DeleteRuleSchema', () => {
  it('accepts ruleId without a confirmationToken', () => {
    expect(DeleteRuleSchema.parse({ ruleId: VALID_UUID })).toEqual({ ruleId: VALID_UUID });
  });

  it('accepts ruleId with a confirmationToken', () => {
    const args = { ruleId: VALID_UUID, confirmationToken: 'tok_abc123' };
    expect(DeleteRuleSchema.parse(args)).toEqual(args);
  });

  it('rejects an empty confirmationToken', () => {
    expect(DeleteRuleSchema.safeParse({ ruleId: VALID_UUID, confirmationToken: '' }).success).toBe(false);
  });
});

describe('DeactivatePackSchema', () => {
  it('accepts a valid slug', () => {
    expect(DeactivatePackSchema.parse({ packId: 'pr-health' })).toEqual({ packId: 'pr-health' });
  });

  it('rejects an uppercase slug', () => {
    expect(DeactivatePackSchema.safeParse({ packId: 'PR-Health' }).success).toBe(false);
  });

  it('rejects a slug starting with a hyphen', () => {
    expect(DeactivatePackSchema.safeParse({ packId: '-bad' }).success).toBe(false);
  });
});

describe('formatZodIssues', () => {
  it('joins multiple issues with semicolons', () => {
    const result = SetRuleModeSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodIssues(result.error);
      expect(formatted).toContain('ruleId');
      expect(formatted).toContain('mode');
      expect(formatted).toContain(';');
    }
  });
});
