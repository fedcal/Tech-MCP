/**
 * Tool: start-timer
 * Start a timer for a task.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TimeStore } from '../services/time-store.js';

export function registerStartTimer(server: McpServer, store: TimeStore): void {
  server.tool(
    'start-timer',
    'Start a timer for a task to track time spent',
    {
      taskId: z.string().describe('Identifier of the task to track'),
      description: z.string().optional().describe('Optional description of what you are working on'),
    },
    async ({ taskId, description }) => {
      try {
        const timer = store.startTimer(taskId, description);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Timer started for task "${taskId}"`,
                  timer,
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
              text: `Failed to start timer: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
