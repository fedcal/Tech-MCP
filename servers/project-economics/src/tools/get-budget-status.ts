/**
 * Tool: get-budget-status
 * Get the current budget status for a project.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { EconomicsStore } from '../services/economics-store.js';

export function registerGetBudgetStatus(server: McpServer, store: EconomicsStore, eventBus?: EventBus): void {
  server.tool(
    'get-budget-status',
    'Get the current budget status including total, spent, remaining, percentage, and breakdown by category',
    {
      projectName: z.string().describe('The name of the project'),
    },
    async ({ projectName }) => {
      try {
        const status = store.getBudgetStatus(projectName);

        // Alert when budget exceeds 80%
        if (status.percentageUsed >= 80 && eventBus) {
          eventBus.publish('economics:budget-alert', {
            project: projectName,
            percentUsed: status.percentageUsed,
            threshold: 80,
            remaining: status.remaining,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get budget status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
