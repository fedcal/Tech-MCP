/**
 * Tool: save-snippet
 * Saves a new code snippet to the store.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SnippetStore } from '../services/snippet-store.js';

export function registerSaveSnippet(server: McpServer, store: SnippetStore): void {
  server.tool(
    'save-snippet',
    'Save a reusable code snippet with title, code, language, description, and tags',
    {
      title: z.string().describe('Title of the snippet'),
      code: z.string().describe('The code content of the snippet'),
      language: z.string().describe('Programming language (e.g., "typescript", "python")'),
      description: z.string().optional().describe('Optional description of what the snippet does'),
      tags: z.array(z.string()).optional().describe('Optional array of tags for categorization'),
    },
    async ({ title, code, language, description, tags }) => {
      try {
        const snippet = store.save({ title, code, language, description, tags });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(snippet, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to save snippet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
