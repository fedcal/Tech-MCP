/**
 * Tool: create-policy
 * Create a new access control policy with allow/deny effect and rules.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { PolicyStore } from '../services/policy-store.js';

export function registerCreatePolicy(
  server: McpServer,
  store: PolicyStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'create-policy',
    'Create a new RBAC/ABAC access control policy with allow or deny effect and matching rules',
    {
      name: z.string().describe('Unique name for the policy'),
      effect: z.enum(['allow', 'deny']).describe('Whether matching requests are allowed or denied'),
      rules: z
        .array(
          z.object({
            server: z.string().describe('Server name to match (e.g. "scrum-board" or "*" for all)'),
            tool: z.string().optional().describe('Tool name to match (omit to match all tools)'),
            roles: z.array(z.string()).describe('Role names that this rule applies to'),
          }),
        )
        .describe('Array of rules defining which server/tool/role combinations this policy matches'),
    },
    async ({ name, effect, rules }) => {
      try {
        const policy = store.createPolicy({ name, effect, rules });

        eventBus?.publish('access:policy-updated', {
          policyId: String(policy.id),
          name: policy.name,
          effect: policy.effect,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(policy, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create policy: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
