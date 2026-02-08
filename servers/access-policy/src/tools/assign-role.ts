/**
 * Tool: assign-role
 * Assign a role to a user. Creates the role if it does not exist.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PolicyStore } from '../services/policy-store.js';

export function registerAssignRole(server: McpServer, store: PolicyStore): void {
  server.tool(
    'assign-role',
    'Assign a role to a user (creates the role if it does not exist)',
    {
      userId: z.string().describe('Identifier of the user to assign the role to'),
      roleName: z.string().describe('Name of the role to assign (created automatically if it does not exist)'),
    },
    async ({ userId, roleName }) => {
      try {
        // Find or create the role
        let role = store.getRoleByName(roleName);
        if (!role) {
          role = store.createRole(roleName);
        }

        store.assignRole(userId, role.id);

        const result = {
          userId,
          role: roleName,
          message: `Role "${roleName}" assigned to user "${userId}"`,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to assign role: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
