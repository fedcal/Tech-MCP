/**
 * Tool: calculate-cycle-time
 * Calculate cycle time statistics from task data.
 * Cross-server: can fetch time data from time-tracking via ClientManager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerCalculateCycleTime(server: McpServer, store: MetricsStore, clientManager?: McpClientManager): void {
  server.tool(
    'calculate-cycle-time',
    'Calculate average, median, and p95 cycle time from task start and completion dates. Optionally enrich with time-tracking data.',
    {
      tasks: z
        .array(
          z.object({
            startedAt: z.string().describe('Task start date/time in ISO 8601 format'),
            completedAt: z.string().describe('Task completion date/time in ISO 8601 format'),
          }),
        )
        .min(1)
        .describe('Array of tasks with start and completion timestamps'),
      fetchTimeData: z
        .boolean()
        .optional()
        .describe('If true, fetch timesheet data from time-tracking server to enrich results'),
      dateRange: z
        .object({
          start: z.string().describe('Start date in YYYY-MM-DD format'),
          end: z.string().describe('End date in YYYY-MM-DD format'),
        })
        .optional()
        .describe('Date range for fetching time-tracking data'),
    },
    async ({ tasks, fetchTimeData, dateRange }) => {
      try {
        // Optionally fetch time-tracking data to enrich cycle time analysis
        let totalTrackedMinutes: number | undefined;
        if (fetchTimeData && clientManager && dateRange) {
          const result = await clientManager.callTool('time-tracking', 'get-timesheet', {
            startDate: dateRange.start,
            endDate: dateRange.end,
          });
          const content = (result as { content: Array<{ type: string; text: string }> }).content;
          const timesheet = JSON.parse(content[0].text);
          totalTrackedMinutes = timesheet.totalMinutes;
        }
        const cycleTimes = tasks.map((task) => {
          const startMs = new Date(task.startedAt).getTime();
          const endMs = new Date(task.completedAt).getTime();
          const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
          return Math.round(days * 100) / 100;
        });

        cycleTimes.sort((a, b) => a - b);

        const average =
          cycleTimes.reduce((sum, v) => sum + v, 0) / cycleTimes.length;

        const median = getPercentile(cycleTimes, 50);
        const p95 = getPercentile(cycleTimes, 95);

        const result: Record<string, unknown> = {
          taskCount: tasks.length,
          averageDays: Math.round(average * 100) / 100,
          medianDays: median,
          p95Days: p95,
          minDays: cycleTimes[0],
          maxDays: cycleTimes[cycleTimes.length - 1],
          distribution: cycleTimes,
        };

        // Enrich with time-tracking data if available
        if (totalTrackedMinutes !== undefined) {
          const totalTrackedHours = Math.round((totalTrackedMinutes / 60) * 100) / 100;
          const avgTrackedHoursPerTask = Math.round((totalTrackedHours / tasks.length) * 100) / 100;
          result.timeTracking = {
            totalTrackedHours,
            avgTrackedHoursPerTask,
          };
        }

        // Persist cycle-time snapshot
        store.saveSnapshot('cycle-time', JSON.stringify(result));

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to calculate cycle time: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

function getPercentile(sortedValues: number[], percentile: number): number {
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const fraction = index - lower;
  return Math.round((sortedValues[lower] + fraction * (sortedValues[upper] - sortedValues[lower])) * 100) / 100;
}
