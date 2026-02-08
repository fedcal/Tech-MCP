/**
 * Tool: create-workflow
 * Create an event-driven workflow definition.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowStore } from '../services/workflow-store.js';

export function registerCreateWorkflow(server: McpServer, store: WorkflowStore): void {
  server.tool(
    'create-workflow',
    'Create an event-driven workflow with trigger event, optional conditions, and a sequence of steps to execute',
    {
      name: z.string().describe('Name of the workflow'),
      description: z.string().optional().describe('Description of what the workflow does'),
      triggerEvent: z.string().describe('Event name that triggers this workflow (e.g. "scrum:sprint-completed")'),
      triggerConditions: z
        .record(z.unknown())
        .optional()
        .describe('Optional conditions to match against the event payload'),
      steps: z
        .array(
          z.object({
            server: z.string().describe('Target MCP server name'),
            tool: z.string().describe('Tool to invoke on the target server'),
            arguments: z.record(z.unknown()).optional().default({}).describe('Arguments for the tool call, supports {{payload.field}} and {{steps[N].result.field}} templates'),
          }),
        )
        .describe('Ordered list of steps to execute'),
    },
    async ({ name, description, triggerEvent, triggerConditions, steps }) => {
      try {
        const workflow = store.createWorkflow({
          name,
          description,
          triggerEvent,
          triggerConditions,
          steps: steps.map((s) => ({ server: s.server, tool: s.tool, arguments: s.arguments })),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(workflow, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
