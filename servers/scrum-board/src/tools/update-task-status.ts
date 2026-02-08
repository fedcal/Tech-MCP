/**
 * Tool: update-task-status
 * Updates the status of a task.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerUpdateTaskStatus(server: McpServer, store: ScrumStore, eventBus?: EventBus): void {
  server.tool(
    'update-task-status',
    'Update the status of a task on the scrum board',
    {
      taskId: z.number().describe('ID of the task to update'),
      status: z
        .enum(['todo', 'in_progress', 'in_review', 'done', 'blocked'])
        .describe('New status for the task'),
    },
    async ({ taskId, status }) => {
      try {
        const previousTask = store.getTask(taskId);
        const previousStatus = previousTask?.status ?? 'unknown';

        const task = store.updateTaskStatus(taskId, status);
        if (!task) {
          return {
            content: [
              { type: 'text' as const, text: `Task with ID ${taskId} not found` },
            ],
            isError: true,
          };
        }

        eventBus?.publish('scrum:task-updated', {
          taskId: String(task.id),
          previousStatus,
          newStatus: task.status,
          assignee: task.assignee ?? undefined,
          sprintId: task.sprintId != null ? String(task.sprintId) : undefined,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to update task status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
