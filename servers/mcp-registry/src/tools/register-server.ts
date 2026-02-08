/**
 * Tool: register-server
 * Register a new MCP server in the registry.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { RegistryStore } from '../services/registry-store.js';

export function registerRegisterServer(
  server: McpServer,
  store: RegistryStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'register-server',
    'Register a new MCP server in the registry with its URL, transport, and capabilities',
    {
      name: z.string().describe('Unique name of the MCP server to register'),
      url: z.string().describe('URL or endpoint of the MCP server'),
      transport: z
        .enum(['stdio', 'http', 'in-memory'])
        .optional()
        .default('stdio')
        .describe('Transport protocol used by the server'),
      capabilities: z
        .array(z.string())
        .optional()
        .describe('List of capabilities provided by the server'),
    },
    async ({ name, url, transport, capabilities }) => {
      try {
        const record = store.registerServer({
          name,
          url,
          transport,
          capabilities,
        });

        eventBus?.publish('registry:server-registered', {
          serverName: record.name,
          url: record.url,
          capabilities: record.capabilities,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(record, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to register server: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
