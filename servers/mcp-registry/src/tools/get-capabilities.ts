/**
 * Tool: get-capabilities
 * Get the registered capabilities of a specific MCP server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegistryStore } from '../services/registry-store.js';

export function registerGetCapabilities(server: McpServer, store: RegistryStore): void {
  server.tool(
    'get-capabilities',
    'Get the registered capabilities of a specific MCP server by ID',
    {
      serverId: z.number().int().positive().describe('The ID of the server'),
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

        const result = {
          serverId: srv.id,
          name: srv.name,
          capabilities: srv.capabilities,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get capabilities: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
