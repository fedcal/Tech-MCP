/**
 * Tool: generate-summary
 * Generates a human-readable summary of a log file.
 * Counts lines, errors, warnings, time span, and top error messages.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { LogStore } from '../services/log-store.js';

const LOG_LEVEL_PATTERN = /\b(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE)\b/i;

const TIMESTAMP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s[+-]\d{4}/,
  /\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}/,
  /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/,
];

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
  const levelMatch = line.match(LOG_LEVEL_PATTERN);
  if (!levelMatch) return null;

  const level = levelMatch[1].toUpperCase() === 'WARNING' ? 'WARN' : levelMatch[1].toUpperCase();
  if (level !== 'ERROR' && level !== 'FATAL' && level !== 'CRITICAL') return null;

  let message = line.substring(levelMatch.index! + levelMatch[0].length).trim();
  message = message.replace(/^[\s\-:|\]>]+/, '').trim();

  return message || null;
}

function parseJsonLine(line: string): {
  level: string | null;
  timestamp: string | null;
  errorMessage: string | null;
} {
  try {
    const obj = JSON.parse(line);
    const level = (obj.level || obj.severity || obj.log_level || '').toString().toUpperCase();
    const timestamp = obj.timestamp || obj.time || obj['@timestamp'] || obj.ts || null;
    const message = obj.message || obj.msg || obj.error || null;

    const normalizedLevel = level === 'WARNING' ? 'WARN' : level;
    const isError = ['ERROR', 'FATAL', 'CRITICAL'].includes(normalizedLevel);

    return {
      level: normalizedLevel || null,
      timestamp: timestamp ? String(timestamp) : null,
      errorMessage: isError ? message : null,
    };
  } catch {
    return { level: null, timestamp: null, errorMessage: null };
  }
}

export function registerGenerateSummary(server: McpServer, store: LogStore): void {
  server.tool(
    'generate-summary',
    'Generate a human-readable summary of a log file including line counts, error/warning counts, time span, and top errors',
    {
      filePath: z.string().describe('Path to the log file to summarize'),
    },
    async ({ filePath }) => {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);

        // Detect format
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
        const isJson = jsonCount > sampleSize / 2;

        const levels: Record<string, number> = {};
        const timestamps: string[] = [];
        const errorMessages = new Map<string, number>();

        for (const line of lines) {
          let level: string | null;
          let timestamp: string | null;
          let errorMessage: string | null;

          if (isJson) {
            const parsed = parseJsonLine(line);
            level = parsed.level;
            timestamp = parsed.timestamp;
            errorMessage = parsed.errorMessage;
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
            errorMessages.set(errorMessage, (errorMessages.get(errorMessage) || 0) + 1);
          }
        }

        const topErrors = Array.from(errorMessages.entries())
          .map(([message, count]) => ({ message, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Build summary text
        const summaryParts: string[] = [];

        summaryParts.push(`Log File Summary: ${filePath}`);
        summaryParts.push('='.repeat(50));
        summaryParts.push('');
        summaryParts.push(`Total lines: ${lines.length}`);
        summaryParts.push('');

        // Log level breakdown
        summaryParts.push('Log Level Breakdown:');
        const levelOrder = ['FATAL', 'CRITICAL', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG', 'TRACE'];
        for (const level of levelOrder) {
          if (levels[level]) {
            const percentage = ((levels[level] / lines.length) * 100).toFixed(1);
            summaryParts.push(`  ${level}: ${levels[level]} (${percentage}%)`);
          }
        }
        // Include any levels not in the standard order
        for (const [level, count] of Object.entries(levels)) {
          if (!levelOrder.includes(level)) {
            const percentage = ((count / lines.length) * 100).toFixed(1);
            summaryParts.push(`  ${level}: ${count} (${percentage}%)`);
          }
        }
        summaryParts.push('');

        // Time range
        if (timestamps.length > 0) {
          summaryParts.push('Time Range:');
          summaryParts.push(`  Earliest: ${timestamps[0]}`);
          summaryParts.push(`  Latest:   ${timestamps[timestamps.length - 1]}`);
          summaryParts.push('');
        }

        // Error rate
        const errorCount = (levels['ERROR'] || 0) + (levels['FATAL'] || 0) + (levels['CRITICAL'] || 0);
        const warnCount = levels['WARN'] || 0;
        if (errorCount > 0 || warnCount > 0) {
          summaryParts.push('Health Indicators:');
          if (errorCount > 0) {
            summaryParts.push(`  Error rate: ${((errorCount / lines.length) * 100).toFixed(1)}%`);
          }
          if (warnCount > 0) {
            summaryParts.push(`  Warning rate: ${((warnCount / lines.length) * 100).toFixed(1)}%`);
          }
          summaryParts.push('');
        }

        // Top errors
        if (topErrors.length > 0) {
          summaryParts.push('Top Error Messages:');
          for (let i = 0; i < topErrors.length; i++) {
            const err = topErrors[i];
            const truncatedMessage =
              err.message.length > 100 ? err.message.substring(0, 100) + '...' : err.message;
            summaryParts.push(`  ${i + 1}. [${err.count}x] ${truncatedMessage}`);
          }
          summaryParts.push('');
        }

        const summary = summaryParts.join('\n');

        // Persist analysis to store
        store.saveAnalysis({
          filePath,
          totalLines: lines.length,
          levels,
          topErrors,
        });

        return {
          content: [{ type: 'text' as const, text: summary }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
