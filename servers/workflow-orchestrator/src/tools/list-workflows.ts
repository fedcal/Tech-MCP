/**
 * Tool: list-workflows
 * List all workflow definitions with optional active filter.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowStore } from '../services/workflow-store.js';

export function registerListWorkflows(server: McpServer, store: WorkflowStore): void {
  server.tool(
    'list-workflows',
    'List all workflow definitions, optionally filtered by active status',
    {
      active: z.boolean().optional().describe('Filter by active status (true/false)'),
    },
    async ({ active }) => {
      try {
        const workflows = store.listWorkflows({ active });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(workflows, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
