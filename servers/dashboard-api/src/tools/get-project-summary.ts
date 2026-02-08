/**
 * Tool: get-project-summary
 * Comprehensive project summary aggregating data from all available MCP servers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { DashboardStore } from '../services/dashboard-store.js';
import { safeCall } from '../services/safe-call.js';

export function registerGetProjectSummary(
  server: McpServer,
  store: DashboardStore,
  clientManager?: McpClientManager,
): void {
  server.tool(
    'get-project-summary',
    'Get a comprehensive project summary aggregating velocity, time tracking, budget, decisions, incidents, quality gates, and retrospectives',
    {
      project: z
        .string()
        .optional()
        .describe('Project name to summarize (default: all)'),
      forceRefresh: z
        .boolean()
        .optional()
        .describe('Force refresh cached data'),
    },
    async ({ project, forceRefresh }) => {
      try {
        const cacheKey = project ?? 'all';

        // Check cache first
        if (!forceRefresh) {
          const cached = store.getCached('project-summary', cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ ...cached, fromCache: true }, null, 2),
                },
              ],
            };
          }
        }

        // Aggregate from ALL available servers
        const [
          velocity,
          timesheet,
          budget,
          decisions,
          incidents,
          qualityGates,
          retros,
        ] = await Promise.all([
          safeCall(clientManager, 'agile-metrics', 'calculate-velocity', {
            sprints: [{ name: 'sample', completedPoints: 0, totalPoints: 0 }],
          }),
          safeCall(clientManager, 'time-tracking', 'get-timesheet', {}),
          safeCall(clientManager, 'project-economics', 'get-budget-status', {
            projectName: project ?? 'default',
          }),
          safeCall(clientManager, 'decision-log', 'list-decisions', {}),
          safeCall(clientManager, 'incident-manager', 'list-incidents', {}),
          safeCall(clientManager, 'quality-gate', 'list-gates', {}),
          safeCall(clientManager, 'retrospective-manager', 'list-retros', {}),
        ]);

        const dataSources = {
          velocity: velocity ? 'available' : 'unavailable',
          timeTracking: timesheet ? 'available' : 'unavailable',
          budget: budget ? 'available' : 'unavailable',
          decisionLog: decisions ? 'available' : 'unavailable',
          incidentManager: incidents ? 'available' : 'unavailable',
          qualityGate: qualityGates ? 'available' : 'unavailable',
          retrospectiveManager: retros ? 'available' : 'unavailable',
        };

        const summary = {
          project: project ?? 'all',
          velocity: velocity ?? { status: 'unavailable' },
          timeTracking: timesheet ?? { status: 'unavailable' },
          budget: budget ?? { status: 'unavailable' },
          decisions: decisions ?? { status: 'unavailable' },
          incidents: incidents ?? { status: 'unavailable' },
          qualityGates: qualityGates ?? { status: 'unavailable' },
          retrospectives: retros ?? { status: 'unavailable' },
          dataSources,
          generatedAt: new Date().toISOString(),
        };

        // Cache with TTL 120 seconds
        store.setCache(
          'project-summary',
          cacheKey,
          summary as unknown as Record<string, unknown>,
          120,
        );

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(summary, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get project summary: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
