/**
 * Tool: get-standup-history
 * Get recent standup history.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { StandupStore } from '../services/standup-store.js';

export function registerGetStandupHistory(server: McpServer, store: StandupStore): void {
  server.tool(
    'get-standup-history',
    'Get standup history for the past N days',
    {
      days: z.number().optional().describe('Number of days to look back (default: 7)'),
    },
    async ({ days }) => {
      try {
        const standups = store.getStandupHistory(days || 7);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(standups, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get standup history: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
