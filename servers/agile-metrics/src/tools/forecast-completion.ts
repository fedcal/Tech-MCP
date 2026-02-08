/**
 * Tool: forecast-completion
 * Monte Carlo simulation for project completion date forecasting.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerForecastCompletion(server: McpServer, store: MetricsStore): void {
  server.tool(
    'forecast-completion',
    'Run a Monte Carlo simulation to forecast how many sprints are needed to complete remaining work',
    {
      remainingPoints: z.number().positive().describe('Number of story points remaining'),
      velocityHistory: z
        .array(z.number().positive())
        .min(1)
        .describe('Array of historical velocity values (story points per sprint)'),
    },
    async ({ remainingPoints, velocityHistory }) => {
      try {
        const simulationCount = 1000;
        const sprintResults: number[] = [];

        for (let i = 0; i < simulationCount; i++) {
          let remaining = remainingPoints;
          let sprints = 0;

          while (remaining > 0) {
            const randomIndex = Math.floor(Math.random() * velocityHistory.length);
            const velocity = velocityHistory[randomIndex];
            remaining -= velocity;
            sprints++;

            // Safety: cap at a reasonable number to avoid infinite loops
            if (sprints > 1000) break;
          }

          sprintResults.push(sprints);
        }

        sprintResults.sort((a, b) => a - b);

        const p50 = getPercentile(sprintResults, 50);
        const p85 = getPercentile(sprintResults, 85);
        const p95 = getPercentile(sprintResults, 95);

        const avgVelocity =
          velocityHistory.reduce((sum, v) => sum + v, 0) / velocityHistory.length;

        const result = {
          remainingPoints,
          velocitySamples: velocityHistory.length,
          averageVelocity: Math.round(avgVelocity * 100) / 100,
          simulations: simulationCount,
          forecast: {
            p50SprintsToCompletion: p50,
            p85SprintsToCompletion: p85,
            p95SprintsToCompletion: p95,
          },
          interpretation: {
            p50: `50% chance of completing in ${p50} sprints or fewer`,
            p85: `85% chance of completing in ${p85} sprints or fewer`,
            p95: `95% chance of completing in ${p95} sprints or fewer`,
          },
        };

        // Persist forecast snapshot
        store.saveSnapshot('forecast', JSON.stringify(result));

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to forecast completion: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

function getPercentile(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}
