/**
 * Tool: get-sprint
 * Retrieves a sprint with its stories and tasks.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerGetSprint(server: McpServer, store: ScrumStore): void {
  server.tool(
    'get-sprint',
    'Get a sprint with its stories and tasks',
    {
      sprintId: z.number().describe('ID of the sprint to retrieve'),
    },
    async ({ sprintId }) => {
      try {
        const board = store.getSprintBoard(sprintId);
        if (!board) {
          return {
            content: [
              { type: 'text' as const, text: `Sprint with ID ${sprintId} not found` },
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
              text: `Failed to get sprint: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
