/**
 * Tool: analyze-coverage
 * Analyzes which functions in a source file have corresponding tests.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { TestGenStore } from '../services/test-gen-store.js';

interface CoverageResult {
  totalFunctions: number;
  coveredFunctions: string[];
  uncoveredFunctions: string[];
  coveragePercentage: number;
  details: Array<{
    functionName: string;
    hasCoverage: boolean;
    testMatches: string[];
  }>;
}

function extractFunctionNames(code: string): string[] {
  const names: string[] = [];

  // Match: export (async) function name(
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    names.push(match[1]);
  }

  // Match: export const name = (async) (...) =>
  const arrowRegex =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    names.push(match[1]);
  }

  // Match: class methods - methodName(
  const methodRegex =
    /(?:public|private|protected|static|async|\s)+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
  while ((match = methodRegex.exec(code)) !== null) {
    const name = match[1];
    if (
      name !== 'constructor' &&
      name !== 'if' &&
      name !== 'for' &&
      name !== 'while' &&
      name !== 'switch' &&
      name !== 'catch' &&
      name !== 'function'
    ) {
      names.push(name);
    }
  }

  // Deduplicate
  return [...new Set(names)];
}

function findTestReferences(testCode: string, functionName: string): string[] {
  const references: string[] = [];

  // Check describe blocks
  const describeRegex = new RegExp(
    `describe\\s*\\(\\s*['"\`]([^'"\`]*${functionName}[^'"\`]*)['"\`]`,
    'gi',
  );
  let match;
  while ((match = describeRegex.exec(testCode)) !== null) {
    references.push(`describe: "${match[1]}"`);
  }

  // Check it/test blocks
  const itRegex = new RegExp(
    `(?:it|test)\\s*\\(\\s*['"\`]([^'"\`]*${functionName}[^'"\`]*)['"\`]`,
    'gi',
  );
  while ((match = itRegex.exec(testCode)) !== null) {
    references.push(`test: "${match[1]}"`);
  }

  // Check direct function calls in test code
  const callRegex = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
  const callCount = (testCode.match(callRegex) || []).length;
  if (callCount > 0 && references.length === 0) {
    references.push(`called ${callCount} time(s) in tests`);
  }

  return references;
}

function analyzeCoverage(sourceCode: string, testCode: string): CoverageResult {
  const functionNames = extractFunctionNames(sourceCode);
  const coveredFunctions: string[] = [];
  const uncoveredFunctions: string[] = [];
  const details: CoverageResult['details'] = [];

  for (const name of functionNames) {
    const testMatches = findTestReferences(testCode, name);
    const hasCoverage = testMatches.length > 0;

    if (hasCoverage) {
      coveredFunctions.push(name);
    } else {
      uncoveredFunctions.push(name);
    }

    details.push({
      functionName: name,
      hasCoverage,
      testMatches,
    });
  }

  return {
    totalFunctions: functionNames.length,
    coveredFunctions,
    uncoveredFunctions,
    coveragePercentage:
      functionNames.length > 0
        ? Math.round((coveredFunctions.length / functionNames.length) * 100)
        : 0,
    details,
  };
}

export function registerAnalyzeCoverage(server: McpServer, store: TestGenStore, eventBus?: EventBus): void {
  server.tool(
    'analyze-coverage',
    'Analyze which functions in source code have corresponding tests',
    {
      sourceCode: z.string().describe('The source code containing functions to check'),
      testCode: z.string().describe('The test code to check for function coverage'),
    },
    async ({ sourceCode, testCode }) => {
      try {
        const result = analyzeCoverage(sourceCode, testCode);

        if (result.totalFunctions === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    message: 'No functions found in the source code.',
                    suggestion:
                      'Ensure the source code contains function declarations or arrow function assignments.',
                    ...result,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Publish coverage report event
        eventBus?.publish('test:coverage-report', {
          filePath: '(inline)',
          coverage: result.coveragePercentage,
          uncoveredLines: result.uncoveredFunctions.map((_, idx) => idx + 1),
        });

        // Persist coverage report to store
        store.saveCoverage({
          filePath: '(inline)',
          coverage: result.coveragePercentage,
          uncoveredLines: result.uncoveredFunctions.map((_, idx) => idx + 1),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing coverage: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
