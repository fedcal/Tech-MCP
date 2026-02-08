/**
 * Tool: compare-responses
 * Compares two HTTP responses by diffing status, headers, and body.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HttpStore } from '../services/http-store.js';

const HttpResponseSchema = z.object({
  status: z.number().describe('HTTP status code'),
  statusText: z.string().optional().describe('HTTP status text'),
  headers: z.record(z.string(), z.string()).optional().describe('Response headers'),
  body: z.unknown().optional().describe('Response body (string or parsed JSON)'),
  durationMs: z.number().optional().describe('Response duration in milliseconds'),
});

interface HeaderDiff {
  onlyInFirst: string[];
  onlyInSecond: string[];
  different: Array<{ header: string; first: string; second: string }>;
  same: string[];
}

function diffHeaders(
  first: Record<string, string> | undefined,
  second: Record<string, string> | undefined,
): HeaderDiff {
  const h1 = first ?? {};
  const h2 = second ?? {};
  const allKeys = new Set([...Object.keys(h1), ...Object.keys(h2)]);

  const onlyInFirst: string[] = [];
  const onlyInSecond: string[] = [];
  const different: Array<{ header: string; first: string; second: string }> = [];
  const same: string[] = [];

  for (const key of allKeys) {
    const inFirst = key in h1;
    const inSecond = key in h2;

    if (inFirst && !inSecond) {
      onlyInFirst.push(key);
    } else if (!inFirst && inSecond) {
      onlyInSecond.push(key);
    } else if (h1[key] !== h2[key]) {
      different.push({ header: key, first: h1[key], second: h2[key] });
    } else {
      same.push(key);
    }
  }

  return { onlyInFirst, onlyInSecond, different, same };
}

function diffBody(first: unknown, second: unknown): { identical: boolean; summary: string } {
  const str1 = typeof first === 'string' ? first : JSON.stringify(first, null, 2);
  const str2 = typeof second === 'string' ? second : JSON.stringify(second, null, 2);

  if (str1 === str2) {
    return { identical: true, summary: 'Bodies are identical' };
  }

  const lines1 = (str1 ?? '').split('\n');
  const lines2 = (str2 ?? '').split('\n');

  // Simple line-based diff summary
  const addedLines = lines2.filter((line) => !lines1.includes(line)).length;
  const removedLines = lines1.filter((line) => !lines2.includes(line)).length;

  return {
    identical: false,
    summary: `Bodies differ: ~${removedLines} line(s) removed, ~${addedLines} line(s) added (first: ${lines1.length} lines, second: ${lines2.length} lines)`,
  };
}

export function registerCompareResponses(server: McpServer, _store: HttpStore): void {
  server.tool(
    'compare-responses',
    'Compare two HTTP responses by diffing status codes, headers, and body content',
    {
      first: HttpResponseSchema.describe('First HTTP response to compare'),
      second: HttpResponseSchema.describe('Second HTTP response to compare'),
    },
    async ({ first, second }) => {
      try {
        const statusMatch = first.status === second.status;
        const statusTextMatch = (first.statusText ?? '') === (second.statusText ?? '');

        const headerDiff = diffHeaders(first.headers, second.headers);
        const bodyDiff = diffBody(first.body, second.body);

        const durationDiff =
          first.durationMs !== undefined && second.durationMs !== undefined
            ? {
                first: first.durationMs,
                second: second.durationMs,
                differenceMs: Math.round((second.durationMs - first.durationMs) * 100) / 100,
              }
            : undefined;

        const identical = statusMatch && statusTextMatch && bodyDiff.identical &&
          headerDiff.onlyInFirst.length === 0 &&
          headerDiff.onlyInSecond.length === 0 &&
          headerDiff.different.length === 0;

        const result = {
          identical,
          status: {
            match: statusMatch,
            first: first.status,
            second: second.status,
          },
          statusText: {
            match: statusTextMatch,
            first: first.statusText ?? '',
            second: second.statusText ?? '',
          },
          headers: {
            onlyInFirst: headerDiff.onlyInFirst,
            onlyInSecond: headerDiff.onlyInSecond,
            different: headerDiff.different,
            sameCount: headerDiff.same.length,
          },
          body: bodyDiff,
          ...(durationDiff ? { duration: durationDiff } : {}),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to compare responses: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
