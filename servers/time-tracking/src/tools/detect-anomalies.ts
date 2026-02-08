/**
 * Tool: detect-anomalies
 * Detect anomalous time tracking patterns (excessive hours, weekend work, duplicates).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { TimeStore } from '../services/time-store.js';

export function registerDetectAnomalies(server: McpServer, store: TimeStore, eventBus?: EventBus): void {
  server.tool(
    'detect-anomalies',
    'Detect anomalous time tracking patterns such as excessive daily hours, weekend work, and duplicate entries',
    {
      userId: z.string().optional().describe('User ID to analyze (default: "default")'),
      days: z.number().int().positive().optional().describe('Number of days to analyze (default: 30)'),
    },
    async ({ userId, days }) => {
      try {
        const report = store.detectAnomalies(userId, days);

        if (report.anomalies.length > 0) {
          for (const anomaly of report.anomalies) {
            const taskId = anomaly.entries[0]?.taskId || 'unknown';
            eventBus?.publish('time:anomaly-detected', {
              userId: report.userId,
              taskId,
              anomalyType: anomaly.type,
              details: anomaly.description,
            });
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to detect anomalies: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
