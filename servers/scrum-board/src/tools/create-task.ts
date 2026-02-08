/**
 * Tool: create-task
 * Creates a new task under a user story.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerCreateTask(server: McpServer, store: ScrumStore): void {
  server.tool(
    'create-task',
    'Create a new task under a user story',
    {
      title: z.string().describe('Task title'),
      description: z.string().describe('Task description'),
      storyId: z.number().describe('ID of the parent user story'),
      assignee: z.string().optional().describe('Person assigned to this task'),
    },
    async ({ title, description, storyId, assignee }) => {
      try {
        const task = store.createTask({ title, description, storyId, assignee });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
