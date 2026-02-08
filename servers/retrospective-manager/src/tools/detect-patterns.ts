/**
 * Tool: detect-patterns
 * Analyze recurring themes across retrospectives.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EventBus } from '@mcp-suite/core';
import type { RetroStore } from '../services/retro-store.js';

export function registerDetectPatterns(server: McpServer, store: RetroStore, eventBus?: EventBus): void {
  server.tool(
    'detect-patterns',
    'Analyze recurring themes and patterns across retrospectives',
    {},
    async () => {
      try {
        const patterns = store.detectPatterns();

        for (const pattern of patterns) {
          eventBus?.publish('retro:pattern-detected', {
            pattern: pattern.pattern,
            occurrences: pattern.occurrences,
            retroIds: pattern.retroIds.map(String),
          });
        }

        const allPatterns = store.getPatterns();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              newPatternsFound: patterns.length,
              allPatterns,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to detect patterns: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
