/**
 * Tool: delete-snippet
 * Deletes a snippet by its ID.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SnippetStore } from '../services/snippet-store.js';

export function registerDeleteSnippet(server: McpServer, store: SnippetStore): void {
  server.tool(
    'delete-snippet',
    'Delete a code snippet by its ID',
    {
      id: z.string().describe('The ID of the snippet to delete'),
    },
    async ({ id }) => {
      try {
        const deleted = store.deleteById(id);

        if (!deleted) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: `Snippet with ID ${id} not found` }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, message: `Snippet ${id} deleted` }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to delete snippet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
