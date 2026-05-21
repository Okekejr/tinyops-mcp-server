import { describe, it, expect } from 'vitest';
import * as handlers from './handlers.js';

describe('MCP tool handlers', () => {
  it('exports all 13 handlers', () => {
    const exported = Object.keys(handlers);
    expect(exported).toHaveLength(13);
    expect(exported).toContain('listRules');
    expect(exported).toContain('getRule');
    expect(exported).toContain('createRule');
    expect(exported).toContain('deleteRule');
    expect(exported).toContain('deactivatePack');
  });
});
