/**
 * Tool: record-decision
 * Record a new Architecture Decision Record (ADR).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { DecisionStore } from '../services/decision-store.js';

export function registerRecordDecision(
  server: McpServer,
  store: DecisionStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'record-decision',
    'Record a new Architecture Decision Record (ADR) with context, alternatives, and consequences',
    {
      title: z.string().describe('Short title of the decision (e.g. "Use PostgreSQL for analytics")'),
      context: z.string().describe('Context and problem statement that led to this decision'),
      decision: z.string().describe('The decision that was made'),
      alternatives: z
        .array(z.string())
        .optional()
        .describe('Alternative options that were considered'),
      consequences: z.string().optional().describe('Expected consequences of this decision'),
      status: z
        .enum(['proposed', 'accepted', 'deprecated', 'superseded'])
        .optional()
        .default('proposed')
        .describe('Status of the decision'),
      relatedTickets: z
        .array(z.string())
        .optional()
        .describe('Related ticket/issue IDs (e.g. ["PROJ-123", "PROJ-456"])'),
    },
    async ({ title, context, decision, alternatives, consequences, status, relatedTickets }) => {
      try {
        const record = store.recordDecision({
          title,
          context,
          decision,
          alternatives,
          consequences,
          status,
          relatedTickets,
        });

        eventBus?.publish('decision:created', {
          decisionId: String(record.id),
          title: record.title,
          status: record.status,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(record, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to record decision: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
