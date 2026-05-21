#!/usr/bin/env node

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Error: TinyOps MCP server requires Node.js 18 or later.\nYou have Node.js ${process.version}. Please upgrade: https://nodejs.org`);
  process.exit(1);
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { TinyOpsClient } from './client.js';

const apiKey = process.env.TINYOPS_API_KEY;
const apiUrl = process.env.TINYOPS_API_URL ?? 'https://api.tinyops.cc';

if (!apiKey) {
  console.error(`Error: TINYOPS_API_KEY environment variable is required.

Get your API key at: https://tinyops.cc/settings?tab=api

Then configure it:
  export TINYOPS_API_KEY="to_live_..."
`);
  process.exit(1);
}

if (!/^to_live_[a-f0-9]{64}$/.test(apiKey)) {
  console.error(`Error: TINYOPS_API_KEY format is invalid.
Expected format: to_live_<64 hex characters>
Get a valid key at: https://tinyops.cc/settings?tab=api`);
  process.exit(1);
}

const client = new TinyOpsClient(apiUrl, apiKey);

try {
  await client.get('/api/mcp/usage');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: Could not connect to TinyOps API at ${apiUrl}.
${msg}

Troubleshooting:
  - Check TINYOPS_API_URL is correct (default: https://api.tinyops.cc)
  - Verify your API key is valid and not expired/revoked
  - Ensure network access to the API endpoint`);
  process.exit(1);
}

const server = new Server(
  { name: 'tinyops', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } },
);

registerTools(server, client);
registerResources(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
