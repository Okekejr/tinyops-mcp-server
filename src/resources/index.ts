import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { TinyOpsClient } from '../client.js';

export function registerResources(server: Server, client: TinyOpsClient) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'tinyops://providers',
        name: 'Available Providers',
        description: 'All supported providers (GitHub, Slack, Vercel, etc.) with their available checks and actions.',
        mimeType: 'application/json',
      },
      {
        uri: 'tinyops://operators',
        name: 'Condition Operators',
        description: 'All condition operators (gt, lt, eq, contains, matches, etc.) with descriptions and examples.',
        mimeType: 'application/json',
      },
      {
        uri: 'tinyops://plan-limits',
        name: 'Plan Limits',
        description: 'Current organization plan limits: max rules, executions/day, integrations, poll interval.',
        mimeType: 'application/json',
      },
      {
        uri: 'tinyops://rule-templates',
        name: 'Rule Templates',
        description: 'Example rule YAML templates for common use cases (stale PR alerts, deploy safety, cost monitoring).',
        mimeType: 'application/json',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'tinyops://providers': {
        const providers = await client.get('/api/mcp/resources/providers');
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(providers, null, 2) }] };
      }
      case 'tinyops://operators': {
        const operators = getOperatorDefinitions();
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(operators, null, 2) }] };
      }
      case 'tinyops://plan-limits': {
        const limits = await client.get('/api/mcp/resources/plan-limits');
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(limits, null, 2) }] };
      }
      case 'tinyops://rule-templates': {
        const templates = getRuleTemplates();
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(templates, null, 2) }] };
      }
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });
}

function getOperatorDefinitions() {
  return [
    { operator: 'gt', description: 'Greater than (numeric)', example: 'value: 3' },
    { operator: 'lt', description: 'Less than (numeric)', example: 'value: 10' },
    { operator: 'eq', description: 'Equal to (string or numeric)', example: 'value: "main"' },
    { operator: 'gte', description: 'Greater than or equal (numeric)', example: 'value: 5' },
    { operator: 'lte', description: 'Less than or equal (numeric)', example: 'value: 100' },
    { operator: 'contains', description: 'String contains substring', example: 'value: "hotfix"' },
    { operator: 'not_contains', description: 'String does not contain substring', example: 'value: "WIP"' },
    { operator: 'matches', description: 'Glob pattern match', example: 'value: "feature/*"' },
    { operator: 'none_match', description: 'No items in array match pattern', example: 'value: "*.test.ts"' },
    { operator: 'any_match', description: 'At least one item matches pattern', example: 'value: "src/**"' },
    { operator: 'is_empty', description: 'Value is empty/zero/null', example: '(no value needed)' },
    { operator: 'is_not_empty', description: 'Value is not empty/zero/null', example: '(no value needed)' },
  ];
}

export function getRuleTemplates() {
  return [
    {
      name: 'Stale PR Alert',
      description: 'Notify Slack when a PR has been open for 3+ days with title and link',
      yaml: `name: Stale PR Alert
trigger:
  type: poll
  interval: 1h
condition:
  provider: github
  check: pr.age
  operator: gt
  value: 3
action:
  provider: slack
  method: send_message
  params:
    channel: "#engineering"
    message: "⚠️ PR #{{condition.pr.number}} \\"{{condition.pr.title}}\\" has been open for {{condition.result}} days. {{condition.pr.url}}"`,
    },
    {
      name: 'Deploy Safety Check',
      description: 'Block deploys on Friday afternoons',
      yaml: `name: Deploy Safety - No Friday Deploys
trigger:
  type: webhook
  event: deployment
  source: github
action:
  provider: github
  method: create_comment
  params:
    body: "Deploy blocked: No deployments on Fridays after 2pm"
schedule_guard:
  during_business_hours: true
  days_of_week: [5]`,
    },
    {
      name: 'Large PR Warning',
      description: 'Alert Slack when a PR exceeds 500 lines changed',
      yaml: `name: Large PR Warning
trigger:
  type: poll
  interval: 15m
condition:
  provider: github
  check: pr.lines_changed
  operator: gt
  value: 500
action:
  provider: slack
  method: send_message
  params:
    channel: "#engineering"
    message: "⚠️ PR #{{condition.pr.number}} \\"{{condition.pr.title}}\\" has {{condition.result}} lines changed. Consider splitting into smaller PRs. {{condition.pr.url}}"`,
    },
    {
      name: 'Missing Description Check',
      description: 'Flag PRs with empty descriptions',
      yaml: `name: Missing PR Description
trigger:
  type: webhook
  event: pull_request.opened
  source: github
condition:
  provider: github
  check: pr.files
  operator: is_not_empty
action:
  provider: slack
  method: send_message
  params:
    channel: "#code-review"
    message: "A PR was opened — review the description and files"`,
    },
    {
      name: 'Daily Execution Summary',
      description: 'Scheduled daily digest of rule executions',
      yaml: `name: Daily Execution Summary
trigger:
  type: schedule
  cron: "0 9 * * 1-5"
condition:
  provider: github
  check: repo.open_prs
  operator: gt
  value: 0
action:
  provider: email
  method: send
  params:
    subject: "TinyOps Daily Summary"
    template: "daily_digest"
schedule_guard:
  days_of_week: [1, 2, 3, 4, 5]`,
    },
    {
      name: 'Vercel Deploy Failure Alert',
      description: 'Alert Slack when a Vercel deployment fails',
      yaml: `name: Vercel Deploy Failure
trigger:
  type: poll
  interval: 5m
condition:
  provider: vercel
  check: deployment.status
  operator: eq
  value: "error"
action:
  provider: slack
  method: send_message
  params:
    channel: "#deploys"
    message: "Vercel deployment failed! Check the dashboard."`,
    },
  ];
}
