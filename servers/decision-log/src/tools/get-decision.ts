/**
 * Tool: get-decision
 * Get a specific Architecture Decision Record by ID, including its links.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DecisionStore } from '../services/decision-store.js';

export function registerGetDecision(server: McpServer, store: DecisionStore): void {
  server.tool(
    'get-decision',
    'Get a specific Architecture Decision Record by ID, including its links',
    {
      id: z.number().int().positive().describe('The decision ID'),
    },
    async ({ id }) => {
      try {
        const decision = store.getDecision(id);
        if (!decision) {
          return {
            content: [{ type: 'text' as const, text: `Decision with id '${id}' not found` }],
            isError: true,
          };
        }
        const links = store.getDecisionLinks(id);
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ ...decision, links }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get decision: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
