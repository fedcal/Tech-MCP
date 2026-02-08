/**
 * Tool: log-standup
 * Log a daily standup entry.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { StandupStore } from '../services/standup-store.js';

export function registerLogStandup(server: McpServer, store: StandupStore, eventBus?: EventBus): void {
  server.tool(
    'log-standup',
    'Log a daily standup with yesterday, today, and blockers',
    {
      yesterday: z.string().describe('What was done yesterday'),
      today: z.string().describe('What is planned for today'),
      blockers: z.string().optional().describe('Any blockers or impediments'),
    },
    async ({ yesterday, today, blockers }) => {
      try {
        const standup = store.logStandup(yesterday, today, blockers);

        // Parse standup fields to compute counts for the event payload
        const yesterdayItems = yesterday.split(/[,;\n]/).filter((s) => s.trim().length > 0);
        const todayItems = today.split(/[,;\n]/).filter((s) => s.trim().length > 0);
        const blockerItems = blockers
          ? blockers.split(/[,;\n]/).filter((s) => s.trim().length > 0)
          : [];

        eventBus?.publish('standup:report-generated', {
          userId: standup.userId,
          date: standup.date,
          tasksDone: yesterdayItems.length,
          tasksInProgress: todayItems.length,
          blockers: blockerItems.length,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(standup, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to log standup: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
