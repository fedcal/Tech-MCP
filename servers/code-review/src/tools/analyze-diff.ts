/**
 * Tool: analyze-diff
 * Analyzes a git diff string for common code issues.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ReviewStore } from '../services/review-store.js';

interface DiffIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  message: string;
  content: string;
}

interface DiffStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

interface ParsedLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  lineNumber: number;
}

function parseDiff(diff: string): { files: string[]; lines: ParsedLine[]; stats: DiffStats } {
  const lines = diff.split('\n');
  const files: string[] = [];
  const parsedLines: ParsedLine[] = [];
  let currentLineNumber = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of lines) {
    // Detect file names from diff headers
    const fileMatch = line.match(/^(?:\+\+\+|---)\s+[ab]\/(.+)/);
    if (fileMatch) {
      if (line.startsWith('+++') && fileMatch[1] !== '/dev/null') {
        files.push(fileMatch[1]);
      }
      continue;
    }

    // Detect hunk headers for line numbers
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      currentLineNumber = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      parsedLines.push({ type: 'added', content: line.substring(1), lineNumber: currentLineNumber });
      linesAdded++;
      currentLineNumber++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      parsedLines.push({ type: 'removed', content: line.substring(1), lineNumber: currentLineNumber });
      linesRemoved++;
    } else if (!line.startsWith('\\')) {
      parsedLines.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line, lineNumber: currentLineNumber });
      currentLineNumber++;
    }
  }

  return {
    files,
    lines: parsedLines,
    stats: { filesChanged: files.length, linesAdded, linesRemoved },
  };
}

function detectIssues(parsedLines: ParsedLine[]): DiffIssue[] {
  const issues: DiffIssue[] = [];

  const addedLines = parsedLines.filter((l) => l.type === 'added');

  for (const line of addedLines) {
    const content = line.content;

    // Console.log left in code
    if (/\bconsole\.(log|debug|info|warn|error|trace|dir)\s*\(/.test(content)) {
      issues.push({
        type: 'console-statement',
        severity: 'warning',
        line: line.lineNumber,
        message: 'Console statement found in added code',
        content: content.trim(),
      });
    }

    // TODO/FIXME/HACK comments
    if (/\/\/\s*(TODO|FIXME|HACK|XXX|TEMP)\b/i.test(content) || /\/\*\s*(TODO|FIXME|HACK|XXX|TEMP)\b/i.test(content)) {
      issues.push({
        type: 'todo-comment',
        severity: 'info',
        line: line.lineNumber,
        message: 'TODO/FIXME comment found in added code',
        content: content.trim(),
      });
    }

    // Debugging code patterns
    if (/\bdebugger\b/.test(content)) {
      issues.push({
        type: 'debugger-statement',
        severity: 'error',
        line: line.lineNumber,
        message: 'Debugger statement found in added code',
        content: content.trim(),
      });
    }

    // alert() calls
    if (/\balert\s*\(/.test(content)) {
      issues.push({
        type: 'alert-statement',
        severity: 'warning',
        line: line.lineNumber,
        message: 'Alert statement found in added code',
        content: content.trim(),
      });
    }

    // Hardcoded credentials patterns
    if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]+['"]/i.test(content)) {
      issues.push({
        type: 'hardcoded-credential',
        severity: 'error',
        line: line.lineNumber,
        message: 'Possible hardcoded credential found',
        content: content.trim(),
      });
    }

    // Empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
      issues.push({
        type: 'empty-catch',
        severity: 'warning',
        line: line.lineNumber,
        message: 'Empty catch block found',
        content: content.trim(),
      });
    }
  }

  // Check for large additions (potential large functions)
  let consecutiveAdded = 0;
  let blockStart = 0;
  for (const line of parsedLines) {
    if (line.type === 'added') {
      if (consecutiveAdded === 0) {
        blockStart = line.lineNumber;
      }
      consecutiveAdded++;
    } else {
      if (consecutiveAdded > 50) {
        issues.push({
          type: 'large-addition',
          severity: 'info',
          line: blockStart,
          message: `Large block of ${consecutiveAdded} lines added - consider breaking into smaller functions`,
          content: `${consecutiveAdded} consecutive lines added starting at line ${blockStart}`,
        });
      }
      consecutiveAdded = 0;
    }
  }

  // Check trailing large block
  if (consecutiveAdded > 50) {
    issues.push({
      type: 'large-addition',
      severity: 'info',
      line: blockStart,
      message: `Large block of ${consecutiveAdded} lines added - consider breaking into smaller functions`,
      content: `${consecutiveAdded} consecutive lines added starting at line ${blockStart}`,
    });
  }

  return issues;
}

export function registerAnalyzeDiff(server: McpServer, store: ReviewStore, eventBus?: EventBus): void {
  server.tool(
    'analyze-diff',
    'Analyze a git diff string for common code issues like console.log statements, TODO comments, debugging code, and large additions',
    {
      diff: z.string().describe('The git diff string to analyze'),
    },
    async ({ diff }) => {
      try {
        const parsed = parseDiff(diff);
        const issues = detectIssues(parsed.lines);

        const summary = {
          stats: parsed.stats,
          files: parsed.files,
          totalIssues: issues.length,
          issuesByType: issues.reduce(
            (acc, issue) => {
              acc[issue.type] = (acc[issue.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          issuesBySeverity: {
            error: issues.filter((i) => i.severity === 'error').length,
            warning: issues.filter((i) => i.severity === 'warning').length,
            info: issues.filter((i) => i.severity === 'info').length,
          },
          issues,
        };

        store.saveReview({
          reviewType: 'analyze-diff',
          filePath: parsed.files[0],
          issuesFound: issues.length,
          suggestions: issues.map((i) => i.message),
          result: JSON.stringify(summary),
        });

        eventBus?.publish('code:commit-analyzed', {
          commitHash: '',
          files: parsed.files,
          stats: {
            filesChanged: parsed.stats.filesChanged,
            linesAdded: parsed.stats.linesAdded,
            linesRemoved: parsed.stats.linesRemoved,
          },
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to analyze diff: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
