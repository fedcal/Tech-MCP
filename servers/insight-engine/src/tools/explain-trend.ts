/**
 * Tool: explain-trend
 * Explain a trend for a given metric.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { InsightStore } from '../services/insight-store.js';
import type { CorrelationEngine } from '../services/correlation-engine.js';

export function registerExplainTrend(
  server: McpServer,
  _store: InsightStore,
  engine: CorrelationEngine,
): void {
  server.tool(
    'explain-trend',
    'Explain a trend for a specific metric with correlated data',
    {
      metric: z.string().describe('The metric to analyze (e.g. velocity, time-logged, budget-spent)'),
      direction: z
        .enum(['up', 'down', 'volatile'])
        .optional()
        .describe('Observed trend direction'),
      period: z.string().optional().describe('Optional time period for analysis'),
    },
    async ({ metric, direction }) => {
      try {
        const result = await engine.explainTrend(metric, direction);

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to explain trend: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
