/**
 * Tool: query-insight
 * Query insights with natural language, backed by cache and cross-server correlation.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { InsightStore } from '../services/insight-store.js';
import type { CorrelationEngine } from '../services/correlation-engine.js';

export function registerQueryInsight(
  server: McpServer,
  store: InsightStore,
  engine: CorrelationEngine,
): void {
  server.tool(
    'query-insight',
    'Query project insights using natural language. Correlates data from multiple servers.',
    {
      question: z.string().describe('Natural language question about the project'),
      forceRefresh: z
        .boolean()
        .optional()
        .default(false)
        .describe('Force refresh bypassing cache'),
    },
    async ({ question, forceRefresh }) => {
      try {
        // Check cache first
        if (!forceRefresh) {
          const cached = store.getCachedAnalysis('insight', question);
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

        const result = await engine.queryInsight(question);

        // Cache the result
        store.cacheAnalysis('insight', question, result);

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
              text: `Failed to query insight: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
