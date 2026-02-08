/**
 * Tool: add-timeline-entry
 * Add a timeline entry to an existing incident.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { IncidentStore } from '../services/incident-store.js';

export function registerAddTimelineEntry(server: McpServer, store: IncidentStore): void {
  server.tool(
    'add-timeline-entry',
    'Add a timeline entry to an existing incident',
    {
      incidentId: z.number().int().positive().describe('The incident ID'),
      description: z.string().describe('Description of the timeline event'),
      source: z.string().optional().describe('Source of the timeline entry (e.g. "monitoring", "engineer")'),
    },
    async ({ incidentId, description, source }) => {
      try {
        const incident = store.getIncident(incidentId);
        if (!incident) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${incidentId}' not found` }],
            isError: true,
          };
        }

        const entry = store.addTimelineEntry(incidentId, description, source);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to add timeline entry: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
