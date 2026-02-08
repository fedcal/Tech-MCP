/**
 * Tool: get-retro
 * Get the full retrospective with items and action items.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RetroStore } from '../services/retro-store.js';

export function registerGetRetro(server: McpServer, store: RetroStore): void {
  server.tool(
    'get-retro',
    'Get the full retrospective with all items and action items',
    {
      retroId: z.number().describe('The retrospective ID'),
    },
    async ({ retroId }) => {
      try {
        const retro = store.getRetro(retroId);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(retro, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get retro: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
