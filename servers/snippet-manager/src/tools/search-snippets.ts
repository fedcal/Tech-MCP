/**
 * Tool: search-snippets
 * Searches snippets by keyword, tag, or language.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SnippetStore } from '../services/snippet-store.js';

export function registerSearchSnippets(server: McpServer, store: SnippetStore): void {
  server.tool(
    'search-snippets',
    'Search code snippets by keyword, tag, or programming language',
    {
      keyword: z.string().optional().describe('Search keyword to match against title, description, or code'),
      tag: z.string().optional().describe('Filter by tag'),
      language: z.string().optional().describe('Filter by programming language'),
    },
    async ({ keyword, tag, language }) => {
      try {
        const snippets = store.search({ keyword, tag, language });

        const result = {
          total: snippets.length,
          snippets,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to search snippets: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
