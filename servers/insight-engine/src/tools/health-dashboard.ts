/**
 * Tool: health-dashboard
 * Get project health dashboard aggregating data from multiple servers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { InsightStore } from '../services/insight-store.js';
import type { CorrelationEngine } from '../services/correlation-engine.js';

export function registerHealthDashboard(
  server: McpServer,
  store: InsightStore,
  engine: CorrelationEngine,
): void {
  server.tool(
    'health-dashboard',
    'Get a project health dashboard aggregating data from multiple MCP servers',
    {
      forceRefresh: z
        .boolean()
        .optional()
        .default(false)
        .describe('Force refresh bypassing cache'),
    },
    async ({ forceRefresh }) => {
      try {
        // Check cache first
        if (!forceRefresh) {
          const cached = store.getCachedAnalysis('health', 'dashboard');
          if (cached) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    { ...JSON.parse(cached.result), cached: true },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
        }

        const result = await engine.getProjectHealth();

        // Cache with 300 second TTL
        store.cacheAnalysis('health', 'dashboard', result, 300);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ...result, cached: false }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get health dashboard: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
