import { describe, it, expect } from 'vitest';
import * as handlers from './handlers.js';

const HANDLER_NAMES = [
  'listRules',
  'getRule',
  'listExecutions',
  'getExecution',
  'getUsage',
  'createRule',
  'updateRule',
  'promoteRule',
  'validateRuleYaml',
  'testRule',
  'setRuleMode',
  'deleteRule',
  'deactivatePack',
] as const;

describe('MCP tool handlers', () => {
  it('exports all 13 handlers', () => {
    const exported = Object.keys(handlers);
    for (const name of HANDLER_NAMES) {
      expect(exported).toContain(name);
    }
    expect(HANDLER_NAMES).toHaveLength(13);
  });
});
