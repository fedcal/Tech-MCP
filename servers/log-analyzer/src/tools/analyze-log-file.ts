/**
 * Tool: analyze-log-file
 * Analyzes a log file for errors and patterns.
 * Reads the file, parses lines, counts by log level, extracts error messages, and finds timestamps.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { LogStore } from '../services/log-store.js';

interface LogStats {
  totalLines: number;
  levels: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  timeRange: { earliest: string | null; latest: string | null };
}

const TIMESTAMP_PATTERNS = [
  // ISO 8601: 2024-01-15T10:30:00.000Z
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  // Common log format: 15/Jan/2024:10:30:00 +0000
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s[+-]\d{4}/,
  // Syslog-style: Jan 15 10:30:00
  /\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}/,
  // Date time: 2024-01-15 10:30:00
  /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/,
];

const LOG_LEVEL_PATTERN = /\b(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE)\b/i;

function extractTimestamp(line: string): string | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function extractLogLevel(line: string): string | null {
  const match = line.match(LOG_LEVEL_PATTERN);
  if (match) {
    const level = match[1].toUpperCase();
    if (level === 'WARNING') return 'WARN';
    return level;
  }
  return null;
}

function extractErrorMessage(line: string): string | null {
  const level = extractLogLevel(line);
  if (level !== 'ERROR' && level !== 'FATAL' && level !== 'CRITICAL') {
    return null;
  }

  // Remove timestamp portion
  let message = line;
  for (const pattern of TIMESTAMP_PATTERNS) {
    message = message.replace(pattern, '').trim();
  }

  // Remove log level
  message = message.replace(LOG_LEVEL_PATTERN, '').trim();

  // Remove leading separators like ] - : etc.
  message = message.replace(/^[\s\-:|\]>]+/, '').trim();

  return message || null;
}

function parseJsonLine(line: string): { level: string | null; timestamp: string | null; message: string | null } {
  try {
    const obj = JSON.parse(line);
    const level = (obj.level || obj.severity || obj.log_level || '').toString().toUpperCase();
    const timestamp = obj.timestamp || obj.time || obj['@timestamp'] || obj.ts || null;
    const message = obj.message || obj.msg || obj.error || null;

    const normalizedLevel = level === 'WARNING' ? 'WARN' : level;

    return {
      level: normalizedLevel || null,
      timestamp: timestamp ? String(timestamp) : null,
      message: ['ERROR', 'FATAL', 'CRITICAL'].includes(normalizedLevel) ? message : null,
    };
  } catch {
    return { level: null, timestamp: null, message: null };
  }
}

function detectFormat(lines: string[]): 'json' | 'plain' {
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

  return jsonCount > sampleSize / 2 ? 'json' : 'plain';
}

export function registerAnalyzeLogFile(server: McpServer, store: LogStore): void {
  server.tool(
    'analyze-log-file',
    'Analyze a log file for errors and patterns. Counts by log level, extracts error messages, and finds time range.',
    {
      filePath: z.string().describe('Path to the log file to analyze'),
      format: z
        .enum(['auto', 'json', 'plain'])
        .optional()
        .describe('Log format: auto-detect, JSON lines, or plain text (default: auto)'),
    },
    async ({ filePath, format }) => {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);

        const effectiveFormat = format === 'auto' || !format ? detectFormat(lines) : format;

        const levels: Record<string, number> = {};
        const errorMessages: Map<string, number> = new Map();
        const timestamps: string[] = [];

        for (const line of lines) {
          let level: string | null;
          let timestamp: string | null;
          let errorMessage: string | null;

          if (effectiveFormat === 'json') {
            const parsed = parseJsonLine(line);
            level = parsed.level;
            timestamp = parsed.timestamp;
            errorMessage = parsed.message;
          } else {
            level = extractLogLevel(line);
            timestamp = extractTimestamp(line);
            errorMessage = extractErrorMessage(line);
          }

          if (level) {
            levels[level] = (levels[level] || 0) + 1;
          }

          if (timestamp) {
            timestamps.push(timestamp);
          }

          if (errorMessage) {
            const count = errorMessages.get(errorMessage) || 0;
            errorMessages.set(errorMessage, count + 1);
          }
        }

        const topErrors = Array.from(errorMessages.entries())
          .map(([message, count]) => ({ message, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const stats: LogStats = {
          totalLines: lines.length,
          levels,
          topErrors,
          timeRange: {
            earliest: timestamps.length > 0 ? timestamps[0] : null,
            latest: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
          },
        };

        // Persist analysis to store
        store.saveAnalysis({
          filePath,
          totalLines: stats.totalLines,
          levels: stats.levels,
          topErrors: stats.topErrors,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to analyze log file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
