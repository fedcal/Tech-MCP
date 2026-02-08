/**
 * Tool: add-retro-item
 * Add an item to a retrospective.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RetroStore } from '../services/retro-store.js';

export function registerAddItem(server: McpServer, store: RetroStore): void {
  server.tool(
    'add-retro-item',
    'Add an item to a retrospective in a specific category',
    {
      retroId: z.number().describe('The retrospective ID'),
      category: z.string().describe('The category for the item (must match retro format)'),
      content: z.string().describe('The content of the item'),
    },
    async ({ retroId, category, content }) => {
      try {
        const item = store.addItem(retroId, category, content);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to add item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
