/**
 * Tool: generate-status-report
 * Generate a weekly status report from recent standups.
 * Cross-server: can fetch sprint board from scrum-board via ClientManager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { StandupStore } from '../services/standup-store.js';

export function registerGenerateStatusReport(server: McpServer, store: StandupStore, clientManager?: McpClientManager): void {
  server.tool(
    'generate-status-report',
    'Generate a status report aggregated from recent standups. Optionally include sprint board data from scrum-board.',
    {
      days: z.number().optional().describe('Number of days to include in the report (default: 7)'),
      includeSprintData: z
        .boolean()
        .optional()
        .describe('If true, fetch current sprint board from scrum-board to enrich the report'),
      sprintId: z
        .number()
        .optional()
        .describe('Specific sprint ID to fetch (defaults to active sprint)'),
    },
    async ({ days, includeSprintData, sprintId }) => {
      try {
        const report = store.generateStatusReport(days || 7);
        const result: Record<string, unknown> = { ...report };

        // Enrich with sprint board data from scrum-board
        if (includeSprintData && clientManager) {
          const boardResult = await clientManager.callTool(
            'scrum-board',
            'sprint-board',
            sprintId != null ? { sprintId } : {},
          );
          const content = (boardResult as { content: Array<{ type: string; text: string }> }).content;
          const board = JSON.parse(content[0].text);
          result.sprintBoard = {
            sprintName: board.sprint.name,
            sprintStatus: board.sprint.status,
            taskCounts: {
              todo: board.columns.todo.length,
              inProgress: board.columns.in_progress.length,
              inReview: board.columns.in_review.length,
              done: board.columns.done.length,
              blocked: board.columns.blocked.length,
            },
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate status report: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
