/**
 * Tool: evaluate-gate
 * Evaluate a Quality Gate against provided metrics.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { GateStore } from '../services/gate-store.js';

export function registerEvaluateGate(
  server: McpServer,
  store: GateStore,
  eventBus?: EventBus,
): void {
  server.tool(
    'evaluate-gate',
    'Evaluate a Quality Gate against provided metric values',
    {
      gateId: z.number().int().positive().describe('The gate ID to evaluate'),
      metrics: z.record(z.string(), z.number()).describe('Map of metric names to their current values'),
    },
    async ({ gateId, metrics }) => {
      try {
        const evaluation = store.evaluateGate(gateId, metrics);
        const gate = store.getGate(gateId);

        if (evaluation.passed) {
          eventBus?.publish('quality:gate-passed', {
            gateName: gate?.name ?? String(gateId),
            project: gate?.projectName ?? '',
            results: evaluation.results,
          });
        } else {
          eventBus?.publish('quality:gate-failed', {
            gateName: gate?.name ?? String(gateId),
            project: gate?.projectName ?? '',
            failures: evaluation.failures,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(evaluation, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to evaluate gate: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
