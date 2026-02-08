/**
 * Tool: discover-servers
 * Discover registered MCP servers with optional filters.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegistryStore } from '../services/registry-store.js';

export function registerDiscoverServers(server: McpServer, store: RegistryStore): void {
  server.tool(
    'discover-servers',
    'Discover registered MCP servers with optional status and transport filters',
    {
      status: z
        .enum(['healthy', 'unhealthy', 'unknown'])
        .optional()
        .describe('Filter by server health status'),
      transport: z
        .enum(['stdio', 'http', 'in-memory'])
        .optional()
        .describe('Filter by transport protocol'),
    },
    async ({ status, transport }) => {
      try {
        const servers = store.listServers({ status, transport });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(servers, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to discover servers: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
