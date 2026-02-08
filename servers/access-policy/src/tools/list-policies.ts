/**
 * Tool: list-policies
 * List all access control policies.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PolicyStore } from '../services/policy-store.js';

export function registerListPolicies(server: McpServer, store: PolicyStore): void {
  server.tool(
    'list-policies',
    'List all RBAC/ABAC access control policies',
    {},
    async () => {
      try {
        const policies = store.listPolicies();

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(policies, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list policies: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
