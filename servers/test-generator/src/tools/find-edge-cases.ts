/**
 * Tool: find-edge-cases
 * Analyzes function code and suggests edge cases to test.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TestGenStore } from '../services/test-gen-store.js';

interface EdgeCase {
  category: string;
  description: string;
  example: string;
  severity: 'high' | 'medium' | 'low';
}

function analyzeEdgeCases(code: string): EdgeCase[] {
  const edgeCases: EdgeCase[] = [];

  // Check for parameters that could be null/undefined
  const paramRegex = /function\s+\w+\s*\(([^)]+)\)/g;
  const arrowParamRegex = /(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\(([^)]+)\)\s*=>/g;
  const allParams: string[] = [];

  let match;
  for (const regex of [paramRegex, arrowParamRegex]) {
    while ((match = regex.exec(code)) !== null) {
      const params = match[1].split(',').map((p) => p.trim());
      allParams.push(...params);
    }
  }

  if (allParams.length > 0) {
    edgeCases.push({
      category: 'null/undefined',
      description: 'Test with null or undefined parameters',
      example: 'Pass null or undefined for each parameter individually',
      severity: 'high',
    });
  }

  // Check for string parameters
  const hasStringParams =
    allParams.some((p) => p.includes('string')) ||
    code.includes('.length') ||
    code.includes('.trim()') ||
    code.includes('.split(') ||
    code.includes('.includes(');

  if (hasStringParams) {
    edgeCases.push({
      category: 'empty-string',
      description: 'Test with empty string input',
      example: 'Pass "" for string parameters',
      severity: 'high',
    });
    edgeCases.push({
      category: 'whitespace-string',
      description: 'Test with whitespace-only strings',
      example: 'Pass "   " or "\\t\\n" for string parameters',
      severity: 'medium',
    });
    edgeCases.push({
      category: 'special-characters',
      description: 'Test with special characters in strings',
      example: 'Pass strings with unicode, emojis, or control characters',
      severity: 'medium',
    });
  }

  // Check for array operations
  const hasArrayOps =
    code.includes('.map(') ||
    code.includes('.filter(') ||
    code.includes('.reduce(') ||
    code.includes('.forEach(') ||
    code.includes('.length') ||
    code.includes('[]') ||
    allParams.some((p) => p.includes('[]') || p.includes('Array'));

  if (hasArrayOps) {
    edgeCases.push({
      category: 'empty-array',
      description: 'Test with empty array',
      example: 'Pass [] for array parameters',
      severity: 'high',
    });
    edgeCases.push({
      category: 'single-element-array',
      description: 'Test with single-element array',
      example: 'Pass [value] to check single-element handling',
      severity: 'medium',
    });
    edgeCases.push({
      category: 'large-array',
      description: 'Test with large array for performance',
      example: 'Pass an array with 10,000+ elements',
      severity: 'low',
    });
  }

  // Check for number operations
  const hasNumberOps =
    code.includes('parseInt') ||
    code.includes('parseFloat') ||
    code.includes('Number(') ||
    code.includes('Math.') ||
    /[+\-*/%]\s*\d/.test(code) ||
    allParams.some((p) => p.includes('number'));

  if (hasNumberOps) {
    edgeCases.push({
      category: 'zero',
      description: 'Test with zero value',
      example: 'Pass 0 for numeric parameters',
      severity: 'high',
    });
    edgeCases.push({
      category: 'negative-numbers',
      description: 'Test with negative numbers',
      example: 'Pass -1, -Infinity for numeric parameters',
      severity: 'high',
    });
    edgeCases.push({
      category: 'boundary-numbers',
      description: 'Test with boundary number values',
      example: 'Pass Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, NaN, Infinity',
      severity: 'medium',
    });
  }

  // Check for division (division by zero)
  if (code.includes('/') && !code.includes('//') && !code.includes('/*')) {
    edgeCases.push({
      category: 'division-by-zero',
      description: 'Test for division by zero',
      example: 'Pass 0 as a divisor to check for Infinity or error handling',
      severity: 'high',
    });
  }

  // Check for async/await or Promise usage
  if (
    code.includes('async') ||
    code.includes('await') ||
    code.includes('Promise') ||
    code.includes('.then(')
  ) {
    edgeCases.push({
      category: 'async-rejection',
      description: 'Test for promise rejection handling',
      example: 'Ensure rejected promises are caught and handled properly',
      severity: 'high',
    });
    edgeCases.push({
      category: 'async-timeout',
      description: 'Test for timeout scenarios',
      example: 'Verify behavior when async operations take too long',
      severity: 'medium',
    });
  }

  // Check for try/catch (error handling)
  if (code.includes('try') && code.includes('catch')) {
    edgeCases.push({
      category: 'error-propagation',
      description: 'Test error handling paths',
      example: 'Force errors in try blocks and verify catch behavior',
      severity: 'high',
    });
  }

  // Check for object property access
  if (code.includes('?.') || code.includes('||') || code.includes('&&')) {
    edgeCases.push({
      category: 'nested-null',
      description: 'Test with deeply nested null/undefined objects',
      example: 'Pass objects with missing nested properties',
      severity: 'medium',
    });
  }

  // Check for regex usage
  if (code.includes('RegExp') || code.includes('.match(') || code.includes('.test(')) {
    edgeCases.push({
      category: 'regex-edge-cases',
      description: 'Test with strings that could break regex patterns',
      example: 'Pass strings with special regex characters: . * + ? ^ $ | \\ [ ] { } ( )',
      severity: 'medium',
    });
  }

  // Check for file system operations
  if (
    code.includes('readFile') ||
    code.includes('writeFile') ||
    code.includes('fs.') ||
    code.includes("from 'fs") ||
    code.includes("from 'node:fs")
  ) {
    edgeCases.push({
      category: 'file-not-found',
      description: 'Test with non-existent file paths',
      example: 'Pass a path to a file that does not exist',
      severity: 'high',
    });
    edgeCases.push({
      category: 'file-permissions',
      description: 'Test with files that lack read/write permissions',
      example: 'Attempt operations on read-only or restricted files',
      severity: 'medium',
    });
  }

  return edgeCases;
}

export function registerFindEdgeCases(server: McpServer, store: TestGenStore): void {
  server.tool(
    'find-edge-cases',
    'Analyze function code and suggest edge cases to test',
    {
      code: z.string().describe('The function code to analyze for edge cases'),
    },
    async ({ code }) => {
      try {
        const edgeCases = analyzeEdgeCases(code);

        if (edgeCases.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    message: 'No specific edge cases identified from static analysis.',
                    suggestion:
                      'Consider testing with basic null/undefined inputs and type mismatches.',
                    edgeCases: [],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const summary = {
          totalEdgeCases: edgeCases.length,
          byCategory: edgeCases.reduce(
            (acc, ec) => {
              acc[ec.category] = (acc[ec.category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          bySeverity: {
            high: edgeCases.filter((e) => e.severity === 'high').length,
            medium: edgeCases.filter((e) => e.severity === 'medium').length,
            low: edgeCases.filter((e) => e.severity === 'low').length,
          },
          edgeCases,
        };

        // Persist edge-case analysis as a generated test record
        store.saveGeneratedTest({
          sourceFilePath: '(inline)',
          framework: 'edge-cases',
          testCount: edgeCases.length,
          generatedCode: JSON.stringify(summary, null, 2),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing edge cases: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
