/**
 * Tool: stop-timer
 * Stop the active timer and save as a time entry.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EventBus } from '@mcp-suite/core';
import type { TimeStore } from '../services/time-store.js';

export function registerStopTimer(server: McpServer, store: TimeStore, eventBus?: EventBus): void {
  server.tool(
    'stop-timer',
    'Stop the active timer and log the time entry',
    {},
    async () => {
      try {
        const entry = store.stopTimer();

        eventBus?.publish('time:entry-logged', {
          taskId: entry.taskId,
          userId: 'default',
          minutes: entry.durationMinutes,
          date: new Date().toISOString().split('T')[0],
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Timer stopped. Logged ${entry.durationMinutes} minutes for task "${entry.taskId}"`,
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
              text: `Failed to stop timer: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
