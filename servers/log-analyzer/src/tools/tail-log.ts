/**
 * Tool: tail-log
 * Gets the last N lines of a log file, with optional filtering.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { LogStore } from '../services/log-store.js';

export function registerTailLog(server: McpServer, _store: LogStore): void {
  server.tool(
    'tail-log',
    'Get the last N lines of a log file, optionally filtering by a search string',
    {
      filePath: z.string().describe('Path to the log file'),
      lines: z
        .number()
        .optional()
        .describe('Number of lines to return from the end (default: 50)'),
      filter: z
        .string()
        .optional()
        .describe('Optional string to filter lines (case-insensitive grep)'),
    },
    async ({ filePath, lines, filter }) => {
      try {
        const numLines = lines ?? 50;
        const content = await readFile(filePath, 'utf-8');
        let allLines = content.split('\n');

        // Apply filter if provided
        if (filter) {
          const filterLower = filter.toLowerCase();
          allLines = allLines.filter((line) => line.toLowerCase().includes(filterLower));
        }

        // Take the last N lines
        const tailLines = allLines.slice(-numLines);

        const result = tailLines.join('\n');

        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to tail log file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
