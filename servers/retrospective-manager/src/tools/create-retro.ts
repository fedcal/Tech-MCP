/**
 * Tool: create-retro
 * Create a new retrospective session.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RetroStore } from '../services/retro-store.js';

export function registerCreateRetro(server: McpServer, store: RetroStore): void {
  server.tool(
    'create-retro',
    'Create a new retrospective session with a specific format',
    {
      sprintId: z.string().optional().describe('Sprint identifier (optional)'),
      format: z
        .enum(['mad-sad-glad', '4ls', 'start-stop-continue'])
        .describe('Retrospective format'),
    },
    async ({ sprintId, format }) => {
      try {
        const retro = store.createRetro(format, sprintId);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(retro, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create retro: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
