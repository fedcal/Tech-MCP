/**
 * Tool: trigger-workflow
 * Manually trigger a workflow execution by ID.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowStore } from '../services/workflow-store.js';
import type { WorkflowEngine } from '../services/workflow-engine.js';

export function registerTriggerWorkflow(
  server: McpServer,
  store: WorkflowStore,
  engine: WorkflowEngine,
): void {
  server.tool(
    'trigger-workflow',
    'Manually trigger a workflow execution by its ID with an optional payload',
    {
      workflowId: z.number().describe('ID of the workflow to trigger'),
      payload: z.record(z.unknown()).optional().default({}).describe('Payload to pass to the workflow'),
    },
    async ({ workflowId, payload }) => {
      try {
        const workflow = store.getWorkflow(workflowId);
        if (!workflow) {
          return {
            content: [{ type: 'text' as const, text: `Workflow with ID ${workflowId} not found` }],
            isError: true,
          };
        }

        if (!workflow.active) {
          return {
            content: [{ type: 'text' as const, text: `Workflow "${workflow.name}" is inactive` }],
            isError: true,
          };
        }

        const run = await engine.executeWorkflow(workflow, payload);
        const steps = store.getStepsForRun(run.id);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ ...run, steps }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to trigger workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
