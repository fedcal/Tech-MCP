/**
 * Tool: supersede-decision
 * Mark a decision as superseded by a newer decision.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { DecisionStore } from '../services/decision-store.js';

export function registerSupersedeDecision(
  server: McpServer,
  store: DecisionStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'supersede-decision',
    'Mark an existing decision as superseded by a newer one',
    {
      id: z.number().int().positive().describe('The ID of the decision being superseded'),
      supersededBy: z.number().int().positive().describe('The ID of the new decision that replaces it'),
    },
    async ({ id, supersededBy }) => {
      try {
        const newDecision = store.getDecision(supersededBy);
        if (!newDecision) {
          return {
            content: [{ type: 'text' as const, text: `Superseding decision with id '${supersededBy}' not found` }],
            isError: true,
          };
        }

        const updated = store.supersedeDecision(id, supersededBy);
        if (!updated) {
          return {
            content: [{ type: 'text' as const, text: `Decision with id '${id}' not found` }],
            isError: true,
          };
        }

        eventBus?.publish('decision:superseded', {
          decisionId: String(id),
          supersededBy: String(supersededBy),
          title: updated.title,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to supersede decision: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
