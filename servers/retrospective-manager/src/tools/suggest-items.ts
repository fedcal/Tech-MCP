/**
 * Tool: suggest-items
 * Get auto-generated retro item suggestions from accumulated events.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RetroStore } from '../services/retro-store.js';

export function registerSuggestItems(server: McpServer, store: RetroStore): void {
  server.tool(
    'suggest-items',
    'Get suggested retro items generated from recent events (anomalies, incidents, gate failures)',
    {
      limit: z.number().int().positive().optional().describe('Max number of suggestions (default: 10)'),
    },
    async ({ limit }) => {
      try {
        const suggestions = store.getSuggestedItems(limit);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(suggestions, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get suggestions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
