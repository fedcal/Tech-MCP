/**
 * Tool: list-decisions
 * List and search Architecture Decision Records.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DecisionStore } from '../services/decision-store.js';

export function registerListDecisions(server: McpServer, store: DecisionStore): void {
  server.tool(
    'list-decisions',
    'List and search Architecture Decision Records with optional filters',
    {
      status: z
        .enum(['proposed', 'accepted', 'deprecated', 'superseded'])
        .optional()
        .describe('Filter by decision status'),
      search: z.string().optional().describe('Search in title, context, and decision text'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
    },
    async ({ status, search, limit }) => {
      try {
        const decisions = store.listDecisions({ status, search, limit });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(decisions, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list decisions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
