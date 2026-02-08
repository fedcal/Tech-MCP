/**
 * Tool: generate-postmortem
 * Generate a formatted post-mortem report for a resolved incident.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { IncidentStore } from '../services/incident-store.js';

export function registerGeneratePostmortem(server: McpServer, store: IncidentStore): void {
  server.tool(
    'generate-postmortem',
    'Generate a formatted post-mortem report for a resolved incident',
    {
      id: z.number().int().positive().describe('The incident ID'),
    },
    async ({ id }) => {
      try {
        const data = store.generatePostmortemData(id);
        if (!data) {
          return {
            content: [{ type: 'text' as const, text: `Incident with id '${id}' not found` }],
            isError: true,
          };
        }

        const { incident, timeline, durationMinutes } = data;

        const affectedList = incident.affectedSystems.length > 0
          ? incident.affectedSystems.map((s) => `- ${s}`).join('\n')
          : '- None specified';

        const timelineText = timeline.length > 0
          ? timeline
              .map((entry) => {
                const src = entry.source ? ` [${entry.source}]` : '';
                return `- **${entry.timestamp}**${src}: ${entry.description}`;
              })
              .join('\n')
          : '- No timeline entries';

        const durationText = durationMinutes > 0
          ? `${durationMinutes} minutes`
          : 'Not yet resolved';

        const report = `# Post-Mortem Report: ${incident.title}

## Incident Summary

| Field | Value |
|-------|-------|
| **ID** | ${incident.id} |
| **Severity** | ${incident.severity} |
| **Status** | ${incident.status} |
| **Created** | ${incident.createdAt} |
| **Resolved** | ${incident.resolvedAt ?? 'N/A'} |
| **Duration** | ${durationText} |

## Description

${incident.description}

## Affected Systems

${affectedList}

## Timeline

${timelineText}

## Resolution

${incident.resolution ?? 'No resolution provided yet.'}

## Root Cause

${incident.rootCause ?? 'No root cause analysis provided yet.'}

## Action Items

- [ ] Review monitoring alerts for early detection
- [ ] Update runbooks based on this incident
- [ ] Schedule follow-up review in 1 week
`;

        return {
          content: [{ type: 'text' as const, text: report }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate postmortem: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
