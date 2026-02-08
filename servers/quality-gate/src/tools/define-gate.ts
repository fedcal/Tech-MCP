/**
 * Tool: define-gate
 * Define a new Quality Gate with metric checks.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { GateStore } from '../services/gate-store.js';

export function registerDefineGate(
  server: McpServer,
  store: GateStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'define-gate',
    'Define a new Quality Gate with metric checks and thresholds',
    {
      name: z.string().describe('Name of the quality gate'),
      projectName: z.string().optional().describe('Project this gate belongs to'),
      checks: z
        .array(
          z.object({
            metric: z.string().describe('Metric name (e.g. "coverage", "complexity")'),
            operator: z.enum(['>=', '<=', '>', '<', '==', '!=']).describe('Comparison operator'),
            threshold: z.number().describe('Threshold value to compare against'),
          }),
        )
        .describe('Array of metric checks for this gate'),
    },
    async ({ name, projectName, checks }) => {
      try {
        const gate = store.defineGate({ name, projectName, checks });

        eventBus?.publish('quality:gate-passed', {
          gateName: gate.name,
          project: gate.projectName ?? '',
          results: {},
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(gate, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to define gate: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
