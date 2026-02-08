/**
 * Tool: find-error-patterns
 * Finds recurring error patterns in a log file.
 * Groups similar error messages by normalizing stack traces and variable parts, then counts occurrences.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { LogStore } from '../services/log-store.js';

const LOG_LEVEL_PATTERN = /\b(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE)\b/i;
const ERROR_LEVELS = new Set(['ERROR', 'FATAL', 'CRITICAL']);

const TIMESTAMP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
  /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/g,
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s[+-]\d{4}/g,
];

/**
 * Normalize an error message to group similar errors together.
 * Replaces variable parts like numbers, IDs, timestamps, IPs, paths, etc.
 */
function normalizeMessage(message: string): string {
  let normalized = message;

  // Remove timestamps
  for (const pattern of TIMESTAMP_PATTERNS) {
    normalized = normalized.replace(pattern, '<TIMESTAMP>');
  }

  // Replace UUIDs
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '<UUID>',
  );

  // Replace hex hashes (8+ chars)
  normalized = normalized.replace(/\b[0-9a-f]{8,}\b/gi, '<HEX>');

  // Replace IP addresses
  normalized = normalized.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g, '<IP>');

  // Replace URLs
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, '<URL>');

  // Replace file paths
  normalized = normalized.replace(/(?:\/[\w.\-]+){2,}/g, '<PATH>');

  // Replace standalone numbers
  normalized = normalized.replace(/\b\d+\b/g, '<NUM>');

  // Replace quoted strings
  normalized = normalized.replace(/"[^"]*"/g, '"<STR>"');
  normalized = normalized.replace(/'[^']*'/g, "'<STR>'");

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

function extractErrorMessage(line: string): string | null {
  const levelMatch = line.match(LOG_LEVEL_PATTERN);
  if (!levelMatch) return null;

  const level = levelMatch[1].toUpperCase() === 'WARNING' ? 'WARN' : levelMatch[1].toUpperCase();
  if (!ERROR_LEVELS.has(level)) return null;

  // Get the message portion after the log level
  const levelIndex = levelMatch.index!;
  let message = line.substring(levelIndex + levelMatch[0].length).trim();

  // Remove leading separators
  message = message.replace(/^[\s\-:|\]>]+/, '').trim();

  return message || null;
}

function extractJsonErrorMessage(line: string): string | null {
  try {
    const obj = JSON.parse(line);
    const level = (obj.level || obj.severity || obj.log_level || '').toString().toUpperCase();
    const normalizedLevel = level === 'WARNING' ? 'WARN' : level;

    if (!ERROR_LEVELS.has(normalizedLevel)) return null;

    return obj.message || obj.msg || obj.error || null;
  } catch {
    return null;
  }
}

interface ErrorPattern {
  pattern: string;
  count: number;
  examples: string[];
}

export function registerFindErrorPatterns(server: McpServer, store: LogStore): void {
  server.tool(
    'find-error-patterns',
    'Find recurring error patterns in a log file by grouping similar error messages',
    {
      filePath: z.string().describe('Path to the log file to analyze'),
      minCount: z
        .number()
        .optional()
        .describe('Minimum number of occurrences to include a pattern (default: 2)'),
    },
    async ({ filePath, minCount }) => {
      try {
        const threshold = minCount ?? 2;
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);

        // Detect format
        let isJson = false;
        const sampleSize = Math.min(lines.length, 10);
        let jsonCount = 0;
        for (let i = 0; i < sampleSize; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith('{')) {
            try {
              JSON.parse(trimmed);
              jsonCount++;
            } catch {
              // not JSON
            }
          }
        }
        isJson = jsonCount > sampleSize / 2;

        // Group error messages by normalized pattern
        const patternMap = new Map<string, { count: number; examples: string[] }>();

        for (const line of lines) {
          const errorMessage = isJson ? extractJsonErrorMessage(line) : extractErrorMessage(line);
          if (!errorMessage) continue;

          const normalized = normalizeMessage(errorMessage);
          const existing = patternMap.get(normalized);

          if (existing) {
            existing.count++;
            if (existing.examples.length < 3) {
              existing.examples.push(errorMessage);
            }
          } else {
            patternMap.set(normalized, { count: 1, examples: [errorMessage] });
          }
        }

        const patterns: ErrorPattern[] = Array.from(patternMap.entries())
          .filter(([, data]) => data.count >= threshold)
          .map(([pattern, data]) => ({
            pattern,
            count: data.count,
            examples: data.examples,
          }))
          .sort((a, b) => b.count - a.count);

        const result = {
          totalPatternsFound: patterns.length,
          minCount: threshold,
          patterns,
        };

        // Persist error patterns to store
        store.saveErrorPatterns({
          filePath,
          patterns,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to find error patterns: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
