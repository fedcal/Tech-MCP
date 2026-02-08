/**
 * Tool: toggle-workflow
 * Enable or disable a workflow.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowStore } from '../services/workflow-store.js';

export function registerToggleWorkflow(server: McpServer, store: WorkflowStore): void {
  server.tool(
    'toggle-workflow',
    'Enable or disable a workflow by setting its active status',
    {
      workflowId: z.number().describe('ID of the workflow to toggle'),
      active: z.boolean().describe('Set to true to activate, false to deactivate'),
    },
    async ({ workflowId, active }) => {
      try {
        const workflow = store.toggleWorkflow(workflowId, active);
        if (!workflow) {
          return {
            content: [{ type: 'text' as const, text: `Workflow with ID ${workflowId} not found` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(workflow, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to toggle workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
