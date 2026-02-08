/**
 * Tool: calculate-velocity
 * Calculate team velocity from sprint data.
 * Cross-server: can fetch sprint data from scrum-board via ClientManager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { MetricsStore } from '../services/metrics-store.js';

export function registerCalculateVelocity(server: McpServer, store: MetricsStore, clientManager?: McpClientManager): void {
  server.tool(
    'calculate-velocity',
    'Calculate team velocity from sprint completion data. Optionally fetch sprint data from scrum-board by providing sprintIds.',
    {
      sprints: z
        .array(
          z.object({
            name: z.string().describe('Sprint name or identifier'),
            completedPoints: z.number().describe('Story points completed in the sprint'),
            totalPoints: z.number().describe('Total story points planned for the sprint'),
          }),
        )
        .optional()
        .describe('Array of sprint data (not needed if sprintIds is provided)'),
      sprintIds: z
        .array(z.number())
        .optional()
        .describe('Sprint IDs to fetch from scrum-board server (requires ClientManager)'),
    },
    async ({ sprints, sprintIds }) => {
      try {
        let sprintData = sprints ?? [];

        // Fetch sprint data from scrum-board if sprintIds provided
        if (sprintIds && sprintIds.length > 0 && clientManager) {
          const fetched = await Promise.all(
            sprintIds.map(async (sprintId) => {
              const result = await clientManager.callTool('scrum-board', 'get-sprint', { sprintId });
              const content = (result as { content: Array<{ type: string; text: string }> }).content;
              const board = JSON.parse(content[0].text);
              const totalTasks =
                board.columns.todo.length +
                board.columns.in_progress.length +
                board.columns.in_review.length +
                board.columns.done.length +
                board.columns.blocked.length;
              return {
                name: board.sprint.name as string,
                completedPoints: board.columns.done.length as number,
                totalPoints: totalTasks,
              };
            }),
          );
          sprintData = [...sprintData, ...fetched];
        }

        if (sprintData.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No sprint data provided. Supply either sprints array or sprintIds.' }],
            isError: true,
          };
        }
        const completedValues = sprintData.map((s) => s.completedPoints);
        const averageVelocity =
          completedValues.reduce((sum, v) => sum + v, 0) / completedValues.length;

        // Calculate trend: compare average of last half vs first half
        const mid = Math.floor(completedValues.length / 2);
        const firstHalf = completedValues.slice(0, mid);
        const secondHalf = completedValues.slice(mid);

        const firstAvg =
          firstHalf.length > 0
            ? firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
            : 0;
        const secondAvg =
          secondHalf.length > 0
            ? secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length
            : 0;

        let trend: 'improving' | 'declining' | 'stable';
        const trendThreshold = 0.1;
        if (secondAvg > firstAvg * (1 + trendThreshold)) {
          trend = 'improving';
        } else if (secondAvg < firstAvg * (1 - trendThreshold)) {
          trend = 'declining';
        } else {
          trend = 'stable';
        }

        const sprintDetails = sprintData.map((s) => ({
          name: s.name,
          completedPoints: s.completedPoints,
          totalPoints: s.totalPoints,
          completionRate: s.totalPoints > 0 ? Math.round((s.completedPoints / s.totalPoints) * 100) : 0,
        }));

        // Persist each sprint's velocity record
        for (const s of sprintDetails) {
          store.saveVelocity({
            sprintName: s.name,
            completedPoints: s.completedPoints,
            totalPoints: s.totalPoints,
            completionRate: s.completionRate,
          });
        }

        const result = {
          averageVelocity: Math.round(averageVelocity * 100) / 100,
          trend,
          sprintCount: sprintData.length,
          highestVelocity: Math.max(...completedValues),
          lowestVelocity: Math.min(...completedValues),
          sprints: sprintDetails,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to calculate velocity: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
