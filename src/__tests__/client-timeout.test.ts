import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TinyOpsClient } from '../client.js';

// Captures the AbortSignal.timeout argument used in each fetch call so the
// test can assert which timeout was applied.
function installFetchSpy(): {
  timeouts: number[];
  restore: () => void;
} {
  const original = globalThis.fetch;
  const timeouts: number[] = [];
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
  const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    timeouts.push(ms);
    return originalTimeout(ms);
  });
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
  return {
    timeouts,
    restore: () => {
      globalThis.fetch = original;
      timeoutSpy.mockRestore();
    },
  };
}

describe('TinyOpsClient per-request timeout override', () => {
  let spy: ReturnType<typeof installFetchSpy>;

  beforeEach(() => {
    spy = installFetchSpy();
  });

  afterEach(() => {
    spy.restore();
  });

  it('uses the instance default timeout when no override is provided', async () => {
    const client = new TinyOpsClient('https://api.example.com', 'to_test_key', { timeoutMs: 5_000 });
    await client.get('/api/anything');
    expect(spy.timeouts).toEqual([5_000]);
  });

  it('honors a per-call timeoutMs override on get', async () => {
    const client = new TinyOpsClient('https://api.example.com', 'to_test_key', { timeoutMs: 5_000 });
    await client.get('/api/anything', { timeoutMs: 45_000 });
    expect(spy.timeouts).toEqual([45_000]);
  });

  it('honors a per-call timeoutMs override on post', async () => {
    const client = new TinyOpsClient('https://api.example.com', 'to_test_key', { timeoutMs: 5_000 });
    await client.post('/api/anything', { foo: 'bar' }, { timeoutMs: 60_000 });
    expect(spy.timeouts).toEqual([60_000]);
  });

  it('honors a per-call timeoutMs override on patch and del', async () => {
    const client = new TinyOpsClient('https://api.example.com', 'to_test_key', { timeoutMs: 5_000 });
    await client.patch('/api/anything', { foo: 'bar' }, { timeoutMs: 20_000 });
    await client.del('/api/anything', { timeoutMs: 25_000 });
    expect(spy.timeouts).toEqual([20_000, 25_000]);
  });

  it('falls back to the default on a later call after a one-off override', async () => {
    const client = new TinyOpsClient('https://api.example.com', 'to_test_key', { timeoutMs: 5_000 });
    await client.post('/api/long', undefined, { timeoutMs: 60_000 });
    await client.get('/api/short');
    expect(spy.timeouts).toEqual([60_000, 5_000]);
  });
});
