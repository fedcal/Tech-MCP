/**
 * Tool: get-server-status
 * Query MCP registry for server status information.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { DashboardStore } from '../services/dashboard-store.js';
import { safeCall } from '../services/safe-call.js';

export function registerGetServerStatus(
  server: McpServer,
  _store: DashboardStore,
  clientManager?: McpClientManager,
): void {
  server.tool(
    'get-server-status',
    'Get status of registered MCP servers from the MCP registry',
    {
      serverName: z
        .string()
        .optional()
        .describe('Filter by specific server name'),
    },
    async ({ serverName }) => {
      try {
        const registry = await safeCall(
          clientManager,
          'mcp-registry',
          'discover-servers',
          {},
        );

        if (!registry) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    status: 'registry-unavailable',
                    message:
                      'MCP registry server is not available. Ensure mcp-registry is running and connected via ClientManager.',
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        let servers: unknown = registry;

        // If registry returns an array under a key, handle both shapes
        if (serverName) {
          if (Array.isArray(registry)) {
            servers = registry.filter(
              (s: Record<string, unknown>) =>
                (s as { name?: string }).name === serverName,
            );
          } else if (
            registry.servers &&
            Array.isArray(registry.servers)
          ) {
            servers = {
              ...registry,
              servers: (
                registry.servers as Array<Record<string, unknown>>
              ).filter(
                (s: Record<string, unknown>) =>
                  (s as { name?: string }).name === serverName,
              ),
            };
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { status: 'ok', serverName: serverName ?? 'all', data: servers },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get server status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
