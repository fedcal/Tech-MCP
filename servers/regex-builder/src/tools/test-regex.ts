/**
 * Tool: test-regex
 * Tests a regex pattern against sample strings.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegexStore } from '../services/regex-store.js';

export function registerTestRegex(server: McpServer, store: RegexStore): void {
  server.tool(
    'test-regex',
    'Test a regular expression against sample strings and return matches',
    {
      pattern: z.string().describe('The regex pattern to test'),
      testStrings: z.array(z.string()).describe('Array of strings to test against'),
      flags: z.string().optional().describe('Regex flags (e.g., "gi", "m")'),
    },
    async ({ pattern, testStrings, flags }) => {
      try {
        const regex = new RegExp(pattern, flags || '');
        const results = testStrings.map((str) => {
          const matches: Array<{
            match: string;
            index: number;
            groups?: Record<string, string>;
          }> = [];

          if (flags?.includes('g')) {
            let match;
            while ((match = regex.exec(str)) !== null) {
              matches.push({
                match: match[0],
                index: match.index,
                ...(match.groups ? { groups: match.groups } : {}),
              });
            }
          } else {
            const match = regex.exec(str);
            if (match) {
              matches.push({
                match: match[0],
                index: match.index,
                ...(match.groups ? { groups: match.groups } : {}),
              });
            }
          }

          return {
            input: str,
            matches,
            matched: matches.length > 0,
          };
        });

        const summary = {
          pattern,
          flags: flags || '',
          totalTests: testStrings.length,
          totalMatched: results.filter((r) => r.matched).length,
          results,
        };

        // Log test operation to history
        store.logOperation({
          operation: 'test',
          pattern,
          flags: flags || '',
          result: summary,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
