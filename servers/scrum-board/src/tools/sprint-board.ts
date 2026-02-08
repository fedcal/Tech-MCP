/**
 * Tool: sprint-board
 * Returns the sprint board with tasks organized into columns by status.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerSprintBoard(server: McpServer, store: ScrumStore): void {
  server.tool(
    'sprint-board',
    'Get the sprint board with tasks organized into columns (todo, in_progress, in_review, done, blocked). Defaults to the active sprint.',
    {
      sprintId: z.number().optional().describe('Sprint ID (defaults to active sprint)'),
    },
    async ({ sprintId }) => {
      try {
        const board = store.getSprintBoard(sprintId);
        if (!board) {
          return {
            content: [
              {
                type: 'text' as const,
                text: sprintId
                  ? `Sprint with ID ${sprintId} not found`
                  : 'No active sprint found',
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(board, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get sprint board: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
