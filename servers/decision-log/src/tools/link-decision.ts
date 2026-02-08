/**
 * Tool: link-decision
 * Link a decision to a ticket, commit, impact, or another decision.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DecisionStore } from '../services/decision-store.js';

export function registerLinkDecision(server: McpServer, store: DecisionStore): void {
  server.tool(
    'link-decision',
    'Link a decision to a ticket, commit, impact, or related item',
    {
      decisionId: z.number().int().positive().describe('The decision ID to link from'),
      linkType: z
        .enum(['ticket', 'commit', 'impact', 'related'])
        .describe('Type of link'),
      targetId: z.string().describe('The ID of the target (ticket ID, commit hash, etc.)'),
      description: z.string().optional().describe('Optional description of the link'),
    },
    async ({ decisionId, linkType, targetId, description }) => {
      try {
        const decision = store.getDecision(decisionId);
        if (!decision) {
          return {
            content: [{ type: 'text' as const, text: `Decision with id '${decisionId}' not found` }],
            isError: true,
          };
        }

        const link = store.linkDecision({ decisionId, linkType, targetId, description });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(link, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to link decision: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
