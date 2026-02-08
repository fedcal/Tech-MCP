/**
 * Tool: get-gate-history
 * Get evaluation history for a Quality Gate.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GateStore } from '../services/gate-store.js';

export function registerGetGateHistory(server: McpServer, store: GateStore): void {
  server.tool(
    'get-gate-history',
    'Get evaluation history for a specific Quality Gate',
    {
      gateId: z.number().int().positive().describe('The gate ID to get history for'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum number of results'),
    },
    async ({ gateId, limit }) => {
      try {
        const history = store.getEvaluationHistory(gateId, limit);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(history, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get gate history: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
