/**
 * Tool: correlate-metrics
 * Correlate metrics from different MCP servers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { InsightStore } from '../services/insight-store.js';
import type { CorrelationEngine } from '../services/correlation-engine.js';

export function registerCorrelateMetrics(
  server: McpServer,
  _store: InsightStore,
  engine: CorrelationEngine,
): void {
  server.tool(
    'correlate-metrics',
    'Correlate metrics from different servers (velocity, time-logged, budget-spent)',
    {
      metrics: z
        .array(z.string())
        .describe('List of metric names to correlate (e.g. velocity, time-logged, budget-spent)'),
      period: z.string().optional().describe('Optional time period for analysis'),
    },
    async ({ metrics }) => {
      try {
        const result = await engine.correlateMetrics(metrics);

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
              text: `Failed to correlate metrics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
