/**
 * Tool: generate-action-items
 * Generate action items from top-voted retro items.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { RetroStore } from '../services/retro-store.js';

export function registerGenerateActionItems(server: McpServer, store: RetroStore, eventBus?: EventBus): void {
  server.tool(
    'generate-action-items',
    'Generate action items from the top-voted retrospective items',
    {
      retroId: z.number().describe('The retrospective ID'),
      topN: z.number().optional().describe('Number of top-voted items to convert (default: 3)'),
    },
    async ({ retroId, topN }) => {
      try {
        const actionItems = store.generateActionItems(retroId, topN || 3);

        for (const item of actionItems) {
          eventBus?.publish('retro:action-item-created', {
            retroId: String(item.retroId),
            item: item.description,
            assignee: item.assignee ?? 'unassigned',
            dueDate: item.dueDate ?? undefined,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(actionItems, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate action items: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
