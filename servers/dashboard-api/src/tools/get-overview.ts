/**
 * Tool: get-overview
 * Aggregated dashboard overview from multiple MCP servers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { DashboardStore } from '../services/dashboard-store.js';
import { safeCall } from '../services/safe-call.js';

export function registerGetOverview(
  server: McpServer,
  store: DashboardStore,
  clientManager?: McpClientManager,
): void {
  server.tool(
    'get-overview',
    'Get an aggregated dashboard overview with velocity, time tracking, budget, and sprint data from all connected MCP servers',
    {
      forceRefresh: z
        .boolean()
        .optional()
        .describe('Force refresh cached data'),
    },
    async ({ forceRefresh }) => {
      try {
        // Check cache first
        if (!forceRefresh) {
          const cached = store.getCached('overview', 'main');
          if (cached) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ ...cached, fromCache: true }, null, 2) }],
            };
          }
        }

        // Aggregate from multiple servers
        const [scrumBoard, velocity, timesheet, budget] = await Promise.all([
          safeCall(clientManager, 'scrum-board', 'list-sprints', {}),
          safeCall(clientManager, 'agile-metrics', 'calculate-velocity', {
            sprints: [{ name: 'sample', completedPoints: 0, totalPoints: 0 }],
          }),
          safeCall(clientManager, 'time-tracking', 'get-timesheet', {}),
          safeCall(clientManager, 'project-economics', 'get-budget-status', {
            projectName: 'default',
          }),
        ]);

        const dataSources = {
          scrumBoard: scrumBoard ? 'available' : 'unavailable',
          velocity: velocity ? 'available' : 'unavailable',
          timeTracking: timesheet ? 'available' : 'unavailable',
          budget: budget ? 'available' : 'unavailable',
        };

        const overview = {
          velocity: velocity ?? { status: 'unavailable' },
          scrumBoard: scrumBoard ?? { status: 'unavailable' },
          timeTracking: timesheet ?? { status: 'unavailable' },
          budget: budget ?? { status: 'unavailable' },
          dataSources,
          generatedAt: new Date().toISOString(),
        };

        // Cache with TTL 120 seconds
        store.setCache('overview', 'main', overview, 120);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(overview, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get overview: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
