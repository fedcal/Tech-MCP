/**
 * Tool: generate-burndown
 * Generate burndown chart data with actual vs ideal lines.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerGenerateBurndown(server: McpServer, store: MetricsStore): void {
  server.tool(
    'generate-burndown',
    'Generate burndown chart data with actual vs ideal burndown lines',
    {
      totalPoints: z.number().positive().describe('Total story points in the sprint'),
      sprintDays: z.number().positive().describe('Number of working days in the sprint'),
      dailyProgress: z
        .array(
          z.object({
            date: z.string().describe('Date in YYYY-MM-DD format'),
            remaining: z.number().describe('Remaining story points at end of day'),
          }),
        )
        .min(1)
        .describe('Array of daily progress entries'),
    },
    async ({ totalPoints, sprintDays, dailyProgress }) => {
      try {
        // Generate ideal burndown line
        const idealBurndown: Array<{ day: number; points: number }> = [];
        const dailyBurnRate = totalPoints / sprintDays;
        for (let day = 0; day <= sprintDays; day++) {
          idealBurndown.push({
            day,
            points: Math.round((totalPoints - dailyBurnRate * day) * 100) / 100,
          });
        }

        // Map actual progress
        const actualBurndown = dailyProgress.map((entry, index) => ({
          day: index + 1,
          date: entry.date,
          remaining: entry.remaining,
        }));

        // Calculate metrics
        const latestRemaining =
          dailyProgress.length > 0
            ? dailyProgress[dailyProgress.length - 1].remaining
            : totalPoints;
        const completedPoints = totalPoints - latestRemaining;
        const daysElapsed = dailyProgress.length;
        const actualBurnRate = daysElapsed > 0 ? completedPoints / daysElapsed : 0;
        const idealRemainingAtDay =
          totalPoints - dailyBurnRate * daysElapsed;

        let status: 'ahead' | 'behind' | 'on-track';
        const tolerance = totalPoints * 0.05;
        if (latestRemaining < idealRemainingAtDay - tolerance) {
          status = 'ahead';
        } else if (latestRemaining > idealRemainingAtDay + tolerance) {
          status = 'behind';
        } else {
          status = 'on-track';
        }

        const result = {
          totalPoints,
          sprintDays,
          daysElapsed,
          completedPoints,
          remainingPoints: latestRemaining,
          status,
          actualBurnRate: Math.round(actualBurnRate * 100) / 100,
          idealBurnRate: Math.round(dailyBurnRate * 100) / 100,
          idealBurndown,
          actualBurndown,
        };

        // Persist burndown snapshot
        store.saveSnapshot('burndown', JSON.stringify(result));

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate burndown: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
