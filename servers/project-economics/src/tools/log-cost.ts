/**
 * Tool: log-cost
 * Log a cost entry for a project.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { EconomicsStore } from '../services/economics-store.js';

export function registerLogCost(server: McpServer, store: EconomicsStore, eventBus?: EventBus): void {
  server.tool(
    'log-cost',
    'Log a cost entry against a project budget',
    {
      projectName: z.string().describe('The name of the project'),
      category: z.string().describe('Cost category (e.g., development, infrastructure, design)'),
      amount: z.number().positive().describe('The cost amount'),
      description: z.string().describe('Description of the cost'),
      date: z.string().optional().describe('Date of the cost (YYYY-MM-DD, defaults to today)'),
    },
    async ({ projectName, category, amount, description, date }) => {
      try {
        const cost = store.logCost(projectName, category, amount, description, date);

        eventBus?.publish('economics:cost-updated', {
          category,
          amount,
          totalSpent: cost.amount,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(cost, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to log cost: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
