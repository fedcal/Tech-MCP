/**
 * Tool: set-budget
 * Set a project budget.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EconomicsStore } from '../services/economics-store.js';

export function registerSetBudget(server: McpServer, store: EconomicsStore): void {
  server.tool(
    'set-budget',
    'Set or update the total budget for a project',
    {
      projectName: z.string().describe('The name of the project'),
      totalBudget: z.number().positive().describe('The total budget amount'),
      currency: z.string().optional().describe('Currency code (default: EUR)'),
    },
    async ({ projectName, totalBudget, currency }) => {
      try {
        const budget = store.setBudget(projectName, totalBudget, currency || 'EUR');

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(budget, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to set budget: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
