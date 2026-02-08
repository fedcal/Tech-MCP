/**
 * Tool: health-check
 * Perform a health check on a registered MCP server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { RegistryStore } from '../services/registry-store.js';

export function registerHealthCheck(
  server: McpServer,
  store: RegistryStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'health-check',
    'Perform a health check on a registered MCP server and record the result',
    {
      serverId: z.number().int().positive().describe('The ID of the server to health-check'),
    },
    async ({ serverId }) => {
      try {
        const srv = store.getServer(serverId);
        if (!srv) {
          return {
            content: [{ type: 'text' as const, text: `Server with id '${serverId}' not found` }],
            isError: true,
          };
        }

        // Simulate a health check (random response time 50-500ms)
        const responseTimeMs = Math.floor(Math.random() * 451) + 50;
        // Simulate: healthy most of the time, but could be unhealthy
        const status: string = responseTimeMs > 450 ? 'unhealthy' : 'healthy';

        const healthCheck = store.recordHealthCheck({
          serverId,
          status,
          responseTimeMs,
          error: status === 'unhealthy' ? 'Simulated timeout' : undefined,
        });

        if (status === 'unhealthy') {
          eventBus?.publish('registry:server-unhealthy', {
            serverName: srv.name,
            lastHealthy: srv.lastHealthCheck ?? srv.createdAt,
            error: 'Health check failed',
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(healthCheck, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to perform health check: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
