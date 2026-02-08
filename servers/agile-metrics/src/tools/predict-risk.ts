/**
 * Tool: predict-risk
 * Predict sprint risk from historical velocity data.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerPredictRisk(server: McpServer, store: MetricsStore, eventBus?: EventBus): void {
  server.tool(
    'predict-risk',
    'Predict sprint risk level based on historical velocity and completion data',
    {
      sprintId: z.string().describe('The sprint ID to predict risk for'),
    },
    async ({ sprintId }) => {
      try {
        const prediction = store.predictRisk(sprintId);

        eventBus?.publish('metrics:risk-predicted', {
          sprintId,
          riskLevel: prediction.riskLevel,
          factors: prediction.factors,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(prediction, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to predict risk: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
