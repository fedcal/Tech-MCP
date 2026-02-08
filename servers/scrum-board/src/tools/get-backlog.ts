/**
 * Tool: get-backlog
 * Returns stories that are not assigned to any sprint.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerGetBacklog(server: McpServer, store: ScrumStore): void {
  server.tool(
    'get-backlog',
    'Get all user stories not assigned to any sprint (the product backlog)',
    {},
    async () => {
      try {
        const stories = store.getBacklog();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(stories, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get backlog: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
