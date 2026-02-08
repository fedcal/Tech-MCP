/**
 * Tool: get-timesheet
 * Retrieve timesheet entries with totals.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TimeStore } from '../services/time-store.js';

export function registerGetTimesheet(server: McpServer, store: TimeStore): void {
  server.tool(
    'get-timesheet',
    'Get timesheet entries and totals for a date range',
    {
      startDate: z
        .string()
        .optional()
        .describe('Start date in YYYY-MM-DD format'),
      endDate: z
        .string()
        .optional()
        .describe('End date in YYYY-MM-DD format'),
      userId: z
        .string()
        .optional()
        .describe('User ID (defaults to "default")'),
    },
    async ({ startDate, endDate, userId }) => {
      try {
        const timesheet = store.getTimesheet(userId, startDate, endDate);

        const totalHours = Math.floor(timesheet.totalMinutes / 60);
        const remainingMinutes = timesheet.totalMinutes % 60;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  totalMinutes: timesheet.totalMinutes,
                  totalFormatted: `${totalHours}h ${remainingMinutes}m`,
                  entryCount: timesheet.entries.length,
                  entries: timesheet.entries,
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
              text: `Failed to get timesheet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
