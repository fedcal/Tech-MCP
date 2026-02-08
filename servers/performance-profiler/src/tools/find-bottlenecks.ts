/**
 * Tool: find-bottlenecks
 * Static analysis of code for performance anti-patterns.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ProfilerStore } from '../services/profiler-store.js';

interface Bottleneck {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  line: number;
  description: string;
  suggestion: string;
  pattern: string;
}

function findBottlenecks(code: string, language: string): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Nested loops detection (O(n^2) or worse)
    if (/\bfor\s*\(/.test(trimmed) || /\bwhile\s*\(/.test(trimmed)) {
      // Look ahead for nested loop within the next 20 lines
      let braceDepth = 0;
      for (let j = i; j < Math.min(i + 50, lines.length); j++) {
        const innerLine = lines[j];
        braceDepth += (innerLine.match(/\{/g) || []).length;
        braceDepth -= (innerLine.match(/\}/g) || []).length;

        if (
          j > i &&
          braceDepth > 0 &&
          (/\bfor\s*\(/.test(innerLine) || /\bwhile\s*\(/.test(innerLine))
        ) {
          bottlenecks.push({
            type: 'nested-loop',
            severity: 'critical',
            line: lineNum,
            description: 'Nested loop detected - potential O(n^2) or worse time complexity',
            suggestion:
              'Consider using a Map/Set for lookups, or restructure to avoid nested iteration',
            pattern: trimmed.substring(0, 80),
          });
          break;
        }
      }
    }

    // Synchronous file operations
    if (
      /\breadFileSync\b/.test(trimmed) ||
      /\bwriteFileSync\b/.test(trimmed) ||
      /\bexecSync\b/.test(trimmed) ||
      /\bexistsSync\b/.test(trimmed) ||
      /\breaddirSync\b/.test(trimmed)
    ) {
      bottlenecks.push({
        type: 'sync-io',
        severity: 'warning',
        line: lineNum,
        description: 'Synchronous I/O operation blocks the event loop',
        suggestion: 'Use async alternatives (readFile, writeFile, etc.) with await',
        pattern: trimmed.substring(0, 80),
      });
    }

    // Array methods in loops (repeated iteration)
    if (
      (/\.indexOf\(/.test(trimmed) || /\.includes\(/.test(trimmed) || /\.find\(/.test(trimmed)) &&
      isInsideLoop(lines, i)
    ) {
      bottlenecks.push({
        type: 'linear-search-in-loop',
        severity: 'warning',
        line: lineNum,
        description: 'Linear search inside a loop creates O(n^2) complexity',
        suggestion: 'Pre-build a Set or Map before the loop for O(1) lookups',
        pattern: trimmed.substring(0, 80),
      });
    }

    // Missing pagination patterns (fetching all records)
    if (
      /\.find\(\s*\{\s*\}\s*\)/.test(trimmed) ||
      /\.findAll\(\s*\)/.test(trimmed) ||
      /SELECT\s+\*\s+FROM/i.test(trimmed)
    ) {
      bottlenecks.push({
        type: 'missing-pagination',
        severity: 'warning',
        line: lineNum,
        description: 'Query fetches all records without pagination or limit',
        suggestion: 'Add limit/offset or cursor-based pagination to prevent loading all records',
        pattern: trimmed.substring(0, 80),
      });
    }

    // Repeated DOM queries (browser/frontend patterns)
    if (
      language === 'javascript' ||
      language === 'typescript' ||
      language === 'jsx' ||
      language === 'tsx'
    ) {
      if (
        /document\.querySelector/.test(trimmed) ||
        /document\.getElementById/.test(trimmed) ||
        /document\.getElementsBy/.test(trimmed)
      ) {
        if (isInsideLoop(lines, i)) {
          bottlenecks.push({
            type: 'dom-query-in-loop',
            severity: 'critical',
            line: lineNum,
            description: 'DOM query inside a loop causes repeated DOM traversal',
            suggestion: 'Cache the DOM reference before the loop',
            pattern: trimmed.substring(0, 80),
          });
        }
      }
    }

    // Unnecessary re-render patterns (React)
    if (/new\s+\w+\(/.test(trimmed) || /\[\s*\]/.test(trimmed) || /\{\s*\}/.test(trimmed)) {
      // Check if inside a render function or component body
      if (isInsideRenderContext(lines, i)) {
        if (/new\s+(Array|Object|Map|Set|RegExp)\(/.test(trimmed)) {
          bottlenecks.push({
            type: 'object-creation-in-render',
            severity: 'warning',
            line: lineNum,
            description:
              'New object/array created in render path may cause unnecessary re-renders',
            suggestion: 'Use useMemo, useCallback, or move to module scope',
            pattern: trimmed.substring(0, 80),
          });
        }
      }
    }

    // String concatenation in loops
    if (/\+=\s*['"`]/.test(trimmed) || /\+=\s*\w/.test(trimmed)) {
      if (isInsideLoop(lines, i) && !trimmed.includes('++') && !trimmed.includes('--')) {
        bottlenecks.push({
          type: 'string-concat-in-loop',
          severity: 'info',
          line: lineNum,
          description: 'String concatenation in loop may be inefficient for large iterations',
          suggestion: 'Use array.push() and array.join() or template literals',
          pattern: trimmed.substring(0, 80),
        });
      }
    }

    // Large JSON.parse/stringify
    if (/JSON\.parse\(/.test(trimmed) || /JSON\.stringify\(/.test(trimmed)) {
      if (isInsideLoop(lines, i)) {
        bottlenecks.push({
          type: 'json-in-loop',
          severity: 'warning',
          line: lineNum,
          description: 'JSON serialization/deserialization inside a loop is expensive',
          suggestion: 'Move JSON operations outside the loop or use streaming parsers',
          pattern: trimmed.substring(0, 80),
        });
      }
    }

    // Recursive function without memoization check
    if (/function\s+(\w+)/.test(trimmed)) {
      const funcMatch = trimmed.match(/function\s+(\w+)/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        // Look ahead for recursive call
        let braceCount = 0;
        for (let j = i; j < Math.min(i + 100, lines.length); j++) {
          braceCount += (lines[j].match(/\{/g) || []).length;
          braceCount -= (lines[j].match(/\}/g) || []).length;
          if (braceCount <= 0 && j > i) break;

          if (j > i && new RegExp(`\\b${funcName}\\s*\\(`).test(lines[j])) {
            bottlenecks.push({
              type: 'recursion',
              severity: 'info',
              line: lineNum,
              description: `Recursive function "${funcName}" detected - verify memoization or tail-call optimization`,
              suggestion:
                'Consider adding memoization or converting to iterative approach for large inputs',
              pattern: trimmed.substring(0, 80),
            });
            break;
          }
        }
      }
    }

    // await inside loop
    if (/\bawait\b/.test(trimmed) && isInsideLoop(lines, i)) {
      bottlenecks.push({
        type: 'sequential-await',
        severity: 'warning',
        line: lineNum,
        description: 'Sequential await inside a loop processes items one at a time',
        suggestion: 'Use Promise.all() or Promise.allSettled() for concurrent execution',
        pattern: trimmed.substring(0, 80),
      });
    }
  }

  return bottlenecks;
}

function isInsideLoop(lines: string[], currentIndex: number): boolean {
  let braceDepth = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const line = lines[i];
    braceDepth -= (line.match(/\{/g) || []).length;
    braceDepth += (line.match(/\}/g) || []).length;

    if (braceDepth < 0) {
      if (/\bfor\s*\(/.test(line) || /\bwhile\s*\(/.test(line) || /\.forEach\(/.test(line)) {
        return true;
      }
    }
  }
  return false;
}

function isInsideRenderContext(lines: string[], currentIndex: number): boolean {
  for (let i = currentIndex; i >= Math.max(0, currentIndex - 30); i--) {
    const line = lines[i];
    if (
      /function\s+\w+.*return\s*\(/.test(line) ||
      /const\s+\w+\s*[:=].*(?:React\.FC|JSX)/.test(line) ||
      /render\s*\(/.test(line)
    ) {
      return true;
    }
  }
  return false;
}

export function registerFindBottlenecks(server: McpServer, eventBus: EventBus | undefined, store: ProfilerStore): void {
  server.tool(
    'find-bottlenecks',
    'Static analysis of code for performance anti-patterns like nested loops, sync I/O, and missing pagination',
    {
      code: z.string().describe('The code to analyze for performance bottlenecks'),
      language: z
        .string()
        .default('typescript')
        .describe('Programming language of the code (typescript, javascript, jsx, tsx)'),
    },
    async ({ code, language }) => {
      try {
        const bottlenecks = findBottlenecks(code, language);

        if (bottlenecks.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    message: 'No performance anti-patterns detected.',
                    note: 'This is a static analysis and may not catch all performance issues. Consider profiling with real data.',
                    bottlenecks: [],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Publish event for each critical bottleneck
        for (const b of bottlenecks.filter((b) => b.severity === 'critical')) {
          eventBus?.publish('perf:bottleneck-found', {
            location: `line ${b.line}`,
            metric: b.type,
            value: b.line,
            threshold: 0,
          });
        }

        const summary = {
          totalIssues: bottlenecks.length,
          bySeverity: {
            critical: bottlenecks.filter((b) => b.severity === 'critical').length,
            warning: bottlenecks.filter((b) => b.severity === 'warning').length,
            info: bottlenecks.filter((b) => b.severity === 'info').length,
          },
          byType: bottlenecks.reduce(
            (acc, b) => {
              acc[b.type] = (acc[b.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          bottlenecks,
        };

        // Persist to store
        store.saveBottleneck({
          target: language,
          bottlenecks: bottlenecks as unknown as Record<string, unknown>[],
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error finding bottlenecks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
