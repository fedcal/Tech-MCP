/**
 * Tool: audit-access
 * Retrieve access audit log entries with optional filters.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PolicyStore } from '../services/policy-store.js';

export function registerAuditAccess(server: McpServer, store: PolicyStore): void {
  server.tool(
    'audit-access',
    'Retrieve access audit log entries with optional filters for userId, server, and limit',
    {
      userId: z.string().optional().describe('Filter audit entries by user identifier'),
      server: z.string().optional().describe('Filter audit entries by server name'),
      limit: z.number().optional().default(50).describe('Maximum number of entries to return (default: 50)'),
    },
    async ({ userId, server: targetServer, limit }) => {
      try {
        const entries = store.getAuditLog({
          userId,
          server: targetServer,
          limit,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to retrieve audit log: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
