/**
 * Tool: create-sprint
 * Creates a new sprint.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ScrumStore } from '../services/scrum-store.js';

export function registerCreateSprint(server: McpServer, store: ScrumStore, eventBus?: EventBus): void {
  server.tool(
    'create-sprint',
    'Create a new sprint with a name, date range, and goals',
    {
      name: z.string().describe('Sprint name (e.g. "Sprint 12")'),
      startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
      endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
      goals: z.array(z.string()).describe('Sprint goals'),
    },
    async ({ name, startDate, endDate, goals }) => {
      try {
        const sprint = store.createSprint({ name, startDate, endDate, goals });

        eventBus?.publish('scrum:sprint-started', {
          sprintId: String(sprint.id),
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(sprint, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create sprint: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
