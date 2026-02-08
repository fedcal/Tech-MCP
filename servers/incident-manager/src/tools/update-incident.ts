/**
 * Tool: update-incident
 * Update an incident's status and/or add a note to the timeline.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { IncidentStore } from '../services/incident-store.js';

export function registerUpdateIncident(
  server: McpServer,
  store: IncidentStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'update-incident',
    'Update an incident status and/or add a timeline note',
    {
      id: z.number().int().positive().describe('The incident ID'),
      status: z
        .enum(['open', 'investigating', 'mitigating', 'resolved', 'postmortem'])
        .optional()
        .describe('New status for the incident'),
      note: z.string().optional().describe('Note to add to the incident timeline'),
    },
    async ({ id, status, note }) => {
      try {
        const existing = store.getIncident(id);
        if (!existing) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${id}' not found` }],
            isError: true,
          };
        }

        const previousSeverity = existing.severity;
        const updated = store.updateIncident(id, { status, note });
        if (!updated) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${id}' not found` }],
            isError: true,
          };
        }

        if (updated.severity !== previousSeverity) {
          eventBus?.publish('incident:escalated', {
            incidentId: String(id),
            title: updated.title,
            previousSeverity,
            newSeverity: updated.severity,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to update incident: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
