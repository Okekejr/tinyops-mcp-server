# TinyOps MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for **[TinyOps](https://tinyops.cc)** — manage developer-workflow automation rules from any MCP-compatible AI client (Claude Desktop, Claude Code, and others).

TinyOps lets teams declare guardrails for their developer workflows as YAML rules
(`trigger → condition → action`) and evaluates them against live data from GitHub, CI, and
more. This server exposes that control plane as MCP tools, so an AI agent can list, create,
test, and promote rules conversationally.

## Features

- **13 tools** covering the full rule lifecycle — list, inspect, create, validate, dry-run, promote, and delete automation rules
- **Execution history** — query when rules fired, whether conditions passed, and why
- **Shadow-first by design** — rules created via MCP always start in shadow mode and must be explicitly promoted to live
- **Safe deletes** — destructive operations require a two-step confirmation token
- **stdio transport** — drops into any standard MCP client configuration

## Requirements

- Node.js 18 or later
- A TinyOps account and API key — create one at [tinyops.cc/settings?tab=api](https://tinyops.cc/settings?tab=api)

## Install

```bash
git clone https://github.com/Okekejr/tinyops-mcp-server.git
cd tinyops-mcp-server
npm install
npm run build
```

This produces `dist/index.js`, the server entrypoint.

## Configuration

The server reads two environment variables:

| Variable           | Required | Default                    | Description                          |
| ------------------ | -------- | -------------------------- | ------------------------------------ |
| `TINYOPS_API_KEY`  | yes      | —                          | Your key, format `to_live_<64 hex>`  |
| `TINYOPS_API_URL`  | no       | `https://api.tinyops.cc`   | Override for self-hosted deployments |

### Claude Desktop / Claude Code

Add the server to your MCP client config:

```json
{
  "mcpServers": {
    "tinyops": {
      "command": "node",
      "args": ["/absolute/path/to/tinyops-mcp-server/dist/index.js"],
      "env": {
        "TINYOPS_API_KEY": "to_live_..."
      }
    }
  }
}
```

Restart the client. The server validates the key format and connectivity on startup, and
exits with a clear error if either fails.

## Tools

| Tool                 | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `list_rules`         | List automation rules (paginated; filter by mode or trigger type)  |
| `get_rule`           | Full details of one rule — YAML source, conditions, actions        |
| `list_executions`    | Query execution history across rules                               |
| `get_execution`      | Full details of a single execution, including errors               |
| `get_usage`          | Current usage vs. plan limits                                      |
| `create_rule`        | Create a rule from YAML (starts in shadow mode)                    |
| `update_rule`        | Update a rule's YAML, preserving its ID and history                |
| `validate_rule_yaml` | Validate rule YAML without creating the rule                       |
| `test_rule`          | Dry-run a rule's conditions against current data                   |
| `promote_rule`       | Promote a rule from shadow mode to live                            |
| `set_rule_mode`      | Switch a rule between `live`, `shadow`, and `disabled`             |
| `delete_rule`        | Delete a rule (two-step confirmation)                              |
| `deactivate_pack`    | Deactivate an automation pack and all its rules                    |

## Development

```bash
npm run dev     # rebuild on change
npm test        # run the test suite (vitest)
```

## License

MIT © Emmanuel Okeke
