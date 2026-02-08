/**
 * Tool: check-access
 * Check whether a user has access to a server/tool combination and log the result.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { PolicyStore } from '../services/policy-store.js';

export function registerCheckAccess(
  server: McpServer,
  store: PolicyStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'check-access',
    'Check whether a user has access to a specific server and optional tool based on RBAC policies',
    {
      userId: z.string().describe('Identifier of the user to check access for'),
      server: z.string().describe('Server name to check access against'),
      tool: z.string().optional().describe('Optional tool name to check access against'),
    },
    async ({ userId, server: targetServer, tool }) => {
      try {
        const result = store.checkAccess(userId, targetServer, tool);

        // Log the access check to the audit log
        store.logAccess(
          userId,
          targetServer,
          tool ?? '*',
          result.allowed ? 'allowed' : 'denied',
          result.reason,
        );

        // Publish access:denied event when access is denied
        if (!result.allowed) {
          eventBus?.publish('access:denied', {
            userId,
            server: targetServer,
            tool: tool ?? '*',
            reason: result.reason,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to check access: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
