/**
 * Tool: resolve-incident
 * Resolve an incident with a resolution summary and optional root cause.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { IncidentStore } from '../services/incident-store.js';

export function registerResolveIncident(
  server: McpServer,
  store: IncidentStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'resolve-incident',
    'Resolve an incident with a resolution summary and optional root cause analysis',
    {
      id: z.number().int().positive().describe('The incident ID'),
      resolution: z.string().describe('Summary of how the incident was resolved'),
      rootCause: z.string().optional().describe('Root cause analysis of the incident'),
    },
    async ({ id, resolution, rootCause }) => {
      try {
        const existing = store.getIncident(id);
        if (!existing) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${id}' not found` }],
            isError: true,
          };
        }

        const resolved = store.resolveIncident(id, resolution, rootCause);
        if (!resolved) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${id}' not found` }],
            isError: true,
          };
        }

        const postmortem = store.generatePostmortemData(id);
        const durationMinutes = postmortem?.durationMinutes ?? 0;

        eventBus?.publish('incident:resolved', {
          incidentId: String(id),
          title: resolved.title,
          resolution,
          durationMinutes,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(resolved, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to resolve incident: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
