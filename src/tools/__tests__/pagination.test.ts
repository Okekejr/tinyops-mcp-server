import { describe, it, expect } from 'vitest';
import { validatePage, validatePageSize } from '../handlers.js';
import { McpToolError } from '../../client.js';

describe('validatePage', () => {
  it('accepts the lower bound', () => {
    expect(validatePage(1)).toBe(1);
  });

  it('accepts the upper bound', () => {
    expect(validatePage(999)).toBe(999);
  });

  it('accepts a typical mid-range value', () => {
    expect(validatePage(42)).toBe(42);
  });

  it('coerces a numeric string', () => {
    expect(validatePage('7')).toBe(7);
  });

  it('rejects 0', () => {
    expect(() => validatePage(0)).toThrow(McpToolError);
  });

  it('rejects negative values', () => {
    expect(() => validatePage(-1)).toThrow(McpToolError);
  });

  it('rejects fractional values', () => {
    expect(() => validatePage(1.5)).toThrow(McpToolError);
  });

  it('rejects non-numeric strings', () => {
    expect(() => validatePage('abc')).toThrow(McpToolError);
  });

  it('rejects values above the cap', () => {
    expect(() => validatePage(1000)).toThrow(McpToolError);
  });

  it('rejects null and undefined', () => {
    expect(() => validatePage(null)).toThrow(McpToolError);
    expect(() => validatePage(undefined)).toThrow(McpToolError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => validatePage(NaN)).toThrow(McpToolError);
    expect(() => validatePage(Infinity)).toThrow(McpToolError);
  });
});

describe('validatePageSize', () => {
  it('accepts the lower bound', () => {
    expect(validatePageSize(1, 50)).toBe(1);
  });

  it('accepts the configured upper bound', () => {
    expect(validatePageSize(50, 50)).toBe(50);
  });

  it('rejects values above the configured upper bound', () => {
    expect(() => validatePageSize(51, 50)).toThrow(McpToolError);
  });

  it('rejects 0', () => {
    expect(() => validatePageSize(0, 50)).toThrow(McpToolError);
  });

  it('rejects negative values', () => {
    expect(() => validatePageSize(-5, 50)).toThrow(McpToolError);
  });

  it('rejects fractional values', () => {
    expect(() => validatePageSize(1.5, 50)).toThrow(McpToolError);
  });

  it('rejects non-numeric strings', () => {
    expect(() => validatePageSize('abc', 50)).toThrow(McpToolError);
  });

  it('coerces a numeric string within range', () => {
    expect(validatePageSize('25', 50)).toBe(25);
  });

  it('respects a smaller per-endpoint max', () => {
    expect(validatePageSize(10, 10)).toBe(10);
    expect(() => validatePageSize(11, 10)).toThrow(McpToolError);
  });
});
