/**
 * Tool: list-incidents
 * List incidents with optional filters for status, severity, and limit.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { IncidentStore } from '../services/incident-store.js';

export function registerListIncidents(server: McpServer, store: IncidentStore): void {
  server.tool(
    'list-incidents',
    'List incidents with optional filters for status, severity, and limit',
    {
      status: z
        .enum(['open', 'investigating', 'mitigating', 'resolved', 'postmortem'])
        .optional()
        .describe('Filter by incident status'),
      severity: z
        .enum(['critical', 'high', 'medium', 'low'])
        .optional()
        .describe('Filter by incident severity'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
    },
    async ({ status, severity, limit }) => {
      try {
        const incidents = store.listIncidents({ status, severity, limit });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(incidents, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list incidents: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
