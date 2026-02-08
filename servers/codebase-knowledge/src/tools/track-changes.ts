/**
 * Tool: track-changes
 * Track changes to codebase modules over time.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { KnowledgeStore } from '../services/knowledge-store.js';

export function registerTrackChanges(server: McpServer, store: KnowledgeStore, eventBus?: EventBus): void {
  server.tool(
    'track-changes',
    'Track a change to a codebase module, or view change history for a module',
    {
      modulePath: z.string().describe('Path to the module (e.g., "src/auth")'),
      changeType: z.string().optional().describe('Type of change: feature, bugfix, refactor, dependency-update, etc. If omitted, returns history only.'),
      description: z.string().optional().describe('Description of the change'),
      filesChanged: z.number().int().optional().describe('Number of files changed'),
      author: z.string().optional().describe('Author of the change'),
      commitRef: z.string().optional().describe('Commit hash or reference'),
      historyLimit: z.number().int().positive().optional().describe('Limit for history results (default: 20)'),
    },
    async ({ modulePath, changeType, description, filesChanged, author, commitRef, historyLimit }) => {
      try {
        if (changeType && description) {
          const change = store.trackChange({
            modulePath,
            changeType,
            description,
            filesChanged,
            author,
            commitRef,
          });

          eventBus?.publish('knowledge:index-updated', {
            directory: modulePath,
            filesIndexed: filesChanged ?? 0,
            timestamp: change.createdAt,
          });

          if (changeType === 'dependency-update') {
            eventBus?.publish('knowledge:dependency-changed', {
              packageName: modulePath,
              previousVersion: '',
              newVersion: description,
            });
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(change, null, 2) }],
          };
        }

        // Return history
        const history = store.getChangeHistory(modulePath, historyLimit);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(history, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to track changes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
