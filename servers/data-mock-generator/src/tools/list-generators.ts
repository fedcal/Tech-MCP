/**
 * Tool: list-generators
 * Lists all available data generator types with descriptions.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generators } from '../services/generators.js';

export function registerListGenerators(server: McpServer): void {
  server.tool(
    'list-generators',
    'List all available mock data generator types and their descriptions',
    {},
    async () => {
      const listing = Object.values(generators).map((gen) => ({
        name: gen.name,
        description: gen.description,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(listing, null, 2),
          },
        ],
      };
    },
  );
}
