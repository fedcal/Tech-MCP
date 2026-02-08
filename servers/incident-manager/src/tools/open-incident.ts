/**
 * Tool: open-incident
 * Open a new incident with severity, description, and affected systems.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { IncidentStore } from '../services/incident-store.js';

export function registerOpenIncident(
  server: McpServer,
  store: IncidentStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'open-incident',
    'Open a new incident with severity, description, and optional affected systems',
    {
      title: z.string().describe('Short title of the incident'),
      severity: z
        .enum(['critical', 'high', 'medium', 'low'])
        .describe('Incident severity level'),
      description: z.string().describe('Detailed description of the incident'),
      affectedSystems: z
        .array(z.string())
        .optional()
        .describe('List of affected systems or services'),
    },
    async ({ title, severity, description, affectedSystems }) => {
      try {
        const incident = store.openIncident({
          title,
          severity,
          description,
          affectedSystems,
        });

        eventBus?.publish('incident:opened', {
          incidentId: String(incident.id),
          title: incident.title,
          severity: incident.severity,
          affectedSystems: incident.affectedSystems,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(incident, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to open incident: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
