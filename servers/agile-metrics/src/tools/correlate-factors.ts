/**
 * Tool: correlate-factors
 * Correlate velocity with external factors.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerCorrelateFactor(server: McpServer, store: MetricsStore): void {
  server.tool(
    'correlate-factors',
    'Record or view correlations between velocity and external factors',
    {
      factorA: z.string().optional().describe('First factor name (e.g., "team-size")'),
      factorB: z.string().optional().describe('Second factor name (e.g., "velocity")'),
      correlation: z.number().min(-1).max(1).optional().describe('Correlation coefficient (-1 to 1)'),
      sampleSize: z.number().int().positive().optional().describe('Number of data points'),
      description: z.string().optional().describe('Description of the correlation'),
    },
    async ({ factorA, factorB, correlation, sampleSize, description }) => {
      try {
        if (factorA && factorB && correlation !== undefined && sampleSize) {
          const result = store.saveCorrelation({
            factorA,
            factorB,
            correlation,
            sampleSize,
            description,
          });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        // List existing correlations
        const correlations = store.listCorrelations();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(correlations, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to correlate factors: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
