/**
 * Tool: cost-per-feature
 * Calculate and track cost per feature or ticket.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { EconomicsStore } from '../services/economics-store.js';

export function registerCostPerFeature(server: McpServer, store: EconomicsStore, eventBus?: EventBus): void {
  server.tool(
    'cost-per-feature',
    'Track cost per feature/ticket, or list all feature costs for a project',
    {
      featureId: z.string().optional().describe('Feature or ticket ID to track cost for'),
      projectName: z.string().describe('Project name'),
      hoursSpent: z.number().positive().optional().describe('Hours spent on this feature (required when tracking)'),
      hourlyRate: z.number().positive().optional().describe('Hourly rate in currency (required when tracking)'),
      description: z.string().optional().describe('Description of the work'),
      currency: z.string().optional().describe('Currency code (default: EUR)'),
    },
    async ({ featureId, projectName, hoursSpent, hourlyRate, description, currency }) => {
      try {
        if (featureId && hoursSpent && hourlyRate) {
          const cost = store.costPerFeature({
            featureId,
            projectName,
            hoursSpent,
            hourlyRate,
            description,
            currency,
          });

          eventBus?.publish('economics:feature-costed', {
            featureId,
            totalCost: cost.totalCost,
            currency: cost.currency,
          });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(cost, null, 2) }],
          };
        }

        // List all feature costs for the project
        const costs = store.getAllFeatureCosts(projectName);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(costs, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to calculate cost per feature: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
