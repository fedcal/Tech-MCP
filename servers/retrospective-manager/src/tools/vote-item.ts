/**
 * Tool: vote-retro-item
 * Vote on a retrospective item.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RetroStore } from '../services/retro-store.js';

export function registerVoteItem(server: McpServer, store: RetroStore): void {
  server.tool(
    'vote-retro-item',
    'Vote on a retrospective item to increase its priority',
    {
      itemId: z.number().describe('The retro item ID to vote on'),
    },
    async ({ itemId }) => {
      try {
        const item = store.voteItem(itemId);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to vote on item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
