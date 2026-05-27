export interface McpError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryAfterSeconds?: number;
}

export class TinyOpsClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    opts?: { timeoutMs?: number },
  ) {
    this.timeoutMs = opts?.timeoutMs ?? 30_000;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-MCP-Client': 'tinyops-mcp-server/0.1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new McpToolError('TIMEOUT', `Request to ${method} ${path} timed out after ${this.timeoutMs}ms`, 408, { timeoutMs: this.timeoutMs, retryable: true });
      }
      throw new McpToolError('NETWORK_ERROR', err instanceof Error ? err.message : 'Network request failed', 0, { retryable: true });
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
      throw new McpToolError(error.code ?? 'API_ERROR', error.message ?? `HTTP ${res.status}`, res.status, error.details);
    }

    if (res.status === 204) return {} as T;
    return res.json() as T;
  }

  get = <T>(path: string) => this.request<T>('GET', path);
  post = <T>(path: string, body?: unknown) => this.request<T>('POST', path, body);
  patch = <T>(path: string, body?: unknown) => this.request<T>('PATCH', path, body);
  del = <T>(path: string) => this.request<T>('DELETE', path);
}

export class McpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpToolError';
  }

  toMcpContent() {
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: this.code,
          message: this.message,
          ...(this.details && { details: this.details }),
          help: this.getHelpText(),
        }, null, 2),
      }],
    };
  }

  private getHelpText(): string {
    switch (this.code) {
      case 'PLAN_LIMIT_EXCEEDED': return 'Upgrade your plan or remove existing resources to continue.';
      case 'API_KEY_INVALID': return 'Check that your API key is valid and not expired or revoked.';
      case 'RATE_LIMITED': return `Try again in ${this.details?.retryAfterSeconds ?? 60} seconds.`;
      case 'SCOPE_INSUFFICIENT': return 'This action requires a higher-scoped API key (write or admin).';
      case 'VALIDATION_FAILED': return 'Check the parameter format. Use list_rules or list_executions to find valid IDs.';
      case 'TIMEOUT': return 'The API server took too long to respond. Try again. If the issue persists, the operation may be processing in the background.';
      case 'NETWORK_ERROR': return 'Could not reach the TinyOps API. Check that the server is running and accessible.';
      default: return 'Check the TinyOps dashboard for more details.';
    }
  }
}
