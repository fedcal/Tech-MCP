/**
 * Tool: get-snippet
 * Retrieves a snippet by its ID.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SnippetStore } from '../services/snippet-store.js';

export function registerGetSnippet(server: McpServer, store: SnippetStore): void {
  server.tool(
    'get-snippet',
    'Get a code snippet by its ID',
    {
      id: z.string().describe('The ID of the snippet to retrieve'),
    },
    async ({ id }) => {
      try {
        const snippet = store.getById(id);

        if (!snippet) {
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
          content: [{ type: 'text' as const, text: JSON.stringify(snippet, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get snippet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
