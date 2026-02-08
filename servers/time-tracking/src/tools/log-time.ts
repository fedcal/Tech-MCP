/**
 * Tool: log-time
 * Manually log a time entry for a task.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { TimeStore } from '../services/time-store.js';

export function registerLogTime(server: McpServer, store: TimeStore, eventBus?: EventBus): void {
  server.tool(
    'log-time',
    'Manually log time spent on a task',
    {
      taskId: z.string().describe('Identifier of the task'),
      durationMinutes: z.number().positive().describe('Duration in minutes'),
      description: z.string().optional().describe('Description of the work done'),
      date: z
        .string()
        .optional()
        .describe('Date of the entry in YYYY-MM-DD format (defaults to today)'),
    },
    async ({ taskId, durationMinutes, description, date }) => {
      try {
        const entry = store.logTime(taskId, durationMinutes, description, date);

        eventBus?.publish('time:entry-logged', {
          taskId,
          userId: 'default',
          minutes: durationMinutes,
          date: entry.date ?? new Date().toISOString().split('T')[0],
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Logged ${durationMinutes} minutes for task "${taskId}"`,
                  entry,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to log time: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
