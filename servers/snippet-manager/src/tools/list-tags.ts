/**
 * Tool: list-tags
 * Lists all tags with their snippet counts.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SnippetStore } from '../services/snippet-store.js';

export function registerListTags(server: McpServer, store: SnippetStore): void {
  server.tool(
    'list-tags',
    'List all tags used across snippets with their counts',
    {},
    async () => {
      try {
        const tags = store.listTags();

        const result = {
          total: tags.length,
          tags,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list tags: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
