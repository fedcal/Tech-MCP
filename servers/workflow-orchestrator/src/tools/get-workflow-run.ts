/**
 * Tool: get-workflow-run
 * Get details of a specific workflow run including its steps.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowStore } from '../services/workflow-store.js';

export function registerGetWorkflowRun(server: McpServer, store: WorkflowStore): void {
  server.tool(
    'get-workflow-run',
    'Get details of a workflow run including all step results',
    {
      runId: z.number().describe('ID of the workflow run'),
    },
    async ({ runId }) => {
      try {
        const run = store.getRun(runId);
        if (!run) {
          return {
            content: [{ type: 'text' as const, text: `Workflow run with ID ${runId} not found` }],
            isError: true,
          };
        }

        const steps = store.getStepsForRun(runId);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ ...run, steps }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get workflow run: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
