/**
 * Tool: get-recent-activity
 * Aggregate recent activity from multiple MCP servers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { DashboardStore } from '../services/dashboard-store.js';
import { safeCall } from '../services/safe-call.js';

interface ActivityItem {
  type: string;
  source: string;
  timestamp: string;
  summary: string;
  data: Record<string, unknown>;
}

export function registerGetRecentActivity(
  server: McpServer,
  store: DashboardStore,
  clientManager?: McpClientManager,
): void {
  server.tool(
    'get-recent-activity',
    'Get recent activity aggregated from decision-log, incident-manager, and retrospective-manager servers',
    {
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of activity items to return (default: 20)'),
      forceRefresh: z
        .boolean()
        .optional()
        .describe('Force refresh cached data'),
    },
    async ({ limit, forceRefresh }) => {
      try {
        const cacheKey = `limit-${limit}`;

        // Check cache first
        if (!forceRefresh) {
          const cached = store.getCached('activity', cacheKey);
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

        // Aggregate from multiple servers
        const [decisions, incidents, retros] = await Promise.all([
          safeCall(clientManager, 'decision-log', 'list-decisions', {}),
          safeCall(clientManager, 'incident-manager', 'list-incidents', {}),
          safeCall(clientManager, 'retrospective-manager', 'list-retros', {}),
        ]);

        const activities: ActivityItem[] = [];

        // Process decisions
        if (decisions && Array.isArray(decisions)) {
          for (const d of decisions) {
            const dec = d as Record<string, unknown>;
            activities.push({
              type: 'decision',
              source: 'decision-log',
              timestamp: (dec.createdAt as string) ?? new Date().toISOString(),
              summary: `Decision: ${dec.title ?? 'untitled'}`,
              data: dec,
            });
          }
        } else if (decisions && typeof decisions === 'object' && !Array.isArray(decisions)) {
          // Might be wrapped in a key
          const items = (decisions as Record<string, unknown>).decisions ?? (decisions as Record<string, unknown>).items;
          if (Array.isArray(items)) {
            for (const d of items) {
              const dec = d as Record<string, unknown>;
              activities.push({
                type: 'decision',
                source: 'decision-log',
                timestamp: (dec.createdAt as string) ?? new Date().toISOString(),
                summary: `Decision: ${dec.title ?? 'untitled'}`,
                data: dec,
              });
            }
          }
        }

        // Process incidents
        if (incidents && Array.isArray(incidents)) {
          for (const i of incidents) {
            const inc = i as Record<string, unknown>;
            activities.push({
              type: 'incident',
              source: 'incident-manager',
              timestamp: (inc.createdAt as string) ?? new Date().toISOString(),
              summary: `Incident: ${inc.title ?? 'untitled'}`,
              data: inc,
            });
          }
        } else if (incidents && typeof incidents === 'object' && !Array.isArray(incidents)) {
          const items = (incidents as Record<string, unknown>).incidents ?? (incidents as Record<string, unknown>).items;
          if (Array.isArray(items)) {
            for (const i of items) {
              const inc = i as Record<string, unknown>;
              activities.push({
                type: 'incident',
                source: 'incident-manager',
                timestamp: (inc.createdAt as string) ?? new Date().toISOString(),
                summary: `Incident: ${inc.title ?? 'untitled'}`,
                data: inc,
              });
            }
          }
        }

        // Process retros
        if (retros && Array.isArray(retros)) {
          for (const r of retros) {
            const retro = r as Record<string, unknown>;
            activities.push({
              type: 'retrospective',
              source: 'retrospective-manager',
              timestamp: (retro.createdAt as string) ?? new Date().toISOString(),
              summary: `Retro: ${retro.title ?? retro.sprintName ?? 'untitled'}`,
              data: retro,
            });
          }
        } else if (retros && typeof retros === 'object' && !Array.isArray(retros)) {
          const items = (retros as Record<string, unknown>).retros ?? (retros as Record<string, unknown>).items;
          if (Array.isArray(items)) {
            for (const r of items) {
              const retro = r as Record<string, unknown>;
              activities.push({
                type: 'retrospective',
                source: 'retrospective-manager',
                timestamp: (retro.createdAt as string) ?? new Date().toISOString(),
                summary: `Retro: ${retro.title ?? retro.sprintName ?? 'untitled'}`,
                data: retro,
              });
            }
          }
        }

        // Sort by timestamp descending and limit
        activities.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        const limited = activities.slice(0, limit);

        const dataSources = {
          decisionLog: decisions ? 'available' : 'unavailable',
          incidentManager: incidents ? 'available' : 'unavailable',
          retrospectiveManager: retros ? 'available' : 'unavailable',
        };

        const result = {
          activities: limited,
          total: limited.length,
          dataSources,
          generatedAt: new Date().toISOString(),
        };

        // Cache with TTL 120 seconds
        store.setCache('activity', cacheKey, result as unknown as Record<string, unknown>, 120);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get recent activity: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
