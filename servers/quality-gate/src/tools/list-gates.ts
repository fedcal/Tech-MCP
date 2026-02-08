/**
 * Tool: list-gates
 * List Quality Gates with optional project filter.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GateStore } from '../services/gate-store.js';

export function registerListGates(server: McpServer, store: GateStore): void {
  server.tool(
    'list-gates',
    'List Quality Gates with optional project name filter',
    {
      projectName: z.string().optional().describe('Filter gates by project name'),
    },
    async ({ projectName }) => {
      try {
        const gates = store.listGates({ projectName });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(gates, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list gates: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
