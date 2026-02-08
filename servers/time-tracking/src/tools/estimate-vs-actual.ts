/**
 * Tool: estimate-vs-actual
 * Compare time estimates with actual time spent on tasks.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TimeStore } from '../services/time-store.js';

export function registerEstimateVsActual(server: McpServer, store: TimeStore): void {
  server.tool(
    'estimate-vs-actual',
    'Compare time estimates with actual time spent. Set an estimate or view comparison.',
    {
      taskId: z.string().describe('The task ID to compare'),
      estimateMinutes: z.number().int().positive().optional().describe('If provided, saves a new estimate for this task'),
      description: z.string().optional().describe('Optional description for the estimate'),
    },
    async ({ taskId, estimateMinutes, description }) => {
      try {
        if (estimateMinutes) {
          store.saveEstimate(taskId, estimateMinutes, description);
        }

        const comparison = store.getEstimateVsActual(taskId);
        if (!comparison) {
          return {
            content: [{ type: 'text' as const, text: `No estimate found for task "${taskId}". Provide estimateMinutes to set one.` }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(comparison, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to compare estimate vs actual: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
