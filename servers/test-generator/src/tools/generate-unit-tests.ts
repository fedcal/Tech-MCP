/**
 * Tool: generate-unit-tests
 * Generates unit test skeletons from source code by parsing function signatures.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import type { TestGenStore } from '../services/test-gen-store.js';

interface ParsedFunction {
  name: string;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
}

function parseFunctions(code: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];

  // Match: export (async) function name(params)
  const funcRegex = /(?:(export)\s+)?(?:(async)\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    functions.push({
      name: match[3],
      params: match[4]
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter((p) => p.length > 0),
      isAsync: match[2] === 'async',
      isExported: match[1] === 'export',
    });
  }

  // Match: export const name = (async) (params) =>
  const arrowRegex =
    /(?:(export)\s+)?const\s+(\w+)\s*=\s*(?:(async)\s+)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    functions.push({
      name: match[2],
      params: match[4]
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter((p) => p.length > 0),
      isAsync: match[3] === 'async',
      isExported: match[1] === 'export',
    });
  }

  return functions;
}

function generateTestCode(
  functions: ParsedFunction[],
  framework: string,
): string {
  const importStatement =
    framework === 'jest'
      ? ''
      : `import { describe, it, expect } from '${framework}';\n`;

  const describes = functions
    .map((fn) => {
      const awaitPrefix = fn.isAsync ? 'await ' : '';
      const asyncModifier = fn.isAsync ? 'async ' : '';
      const paramPlaceholders = fn.params
        .map((p) => `/* ${p} */`)
        .join(', ');

      return `describe('${fn.name}', () => {
  it('should exist and be callable', ${asyncModifier}() => {
    expect(${fn.name}).toBeDefined();
    expect(typeof ${fn.name}).toBe('function');
  });

  it('should return expected result with valid input', ${asyncModifier}() => {
    const result = ${awaitPrefix}${fn.name}(${paramPlaceholders});
    expect(result).toBeDefined();
    // TODO: Add specific assertions
  });

  it('should handle edge cases', ${asyncModifier}() => {
    // TODO: Test with null/undefined inputs
    // TODO: Test with empty values
    // TODO: Test with boundary values
  });
});`;
    })
    .join('\n\n');

  return `${importStatement}
// Auto-generated test skeleton
// TODO: Update import path to match your project structure
// import { ${functions.filter((f) => f.isExported).map((f) => f.name).join(', ')} } from './source';

${describes}
`;
}

export function registerGenerateUnitTests(server: McpServer, store: TestGenStore, eventBus?: EventBus, clientManager?: McpClientManager): void {
  server.tool(
    'generate-unit-tests',
    'Generate unit test skeletons from source code. Optionally provide a filePath to fetch module structure from codebase-knowledge.',
    {
      code: z
        .string()
        .optional()
        .describe('The source code to generate tests for (not needed if filePath is provided)'),
      filePath: z
        .string()
        .optional()
        .describe('Path to source file; module info will be fetched from codebase-knowledge server'),
      language: z
        .string()
        .default('typescript')
        .describe('Programming language of the source code'),
      framework: z
        .string()
        .default('vitest')
        .describe('Test framework to use (vitest, jest, mocha)'),
    },
    async ({ code, filePath, language, framework }) => {
      try {
        let sourceCode = code ?? '';

        // Fetch module info from codebase-knowledge if filePath provided
        if (filePath && clientManager && !sourceCode) {
          const result = await clientManager.callTool('codebase-knowledge', 'explain-module', { filePath });
          const content = (result as { content: Array<{ type: string; text: string }> }).content;
          const moduleInfo = JSON.parse(content[0].text);
          // Build synthetic function signatures from module analysis
          const fnDefs = (moduleInfo.functions as string[])
            .map((name: string) => {
              const isExported = (moduleInfo.exports as string[]).includes(name);
              return `${isExported ? 'export ' : ''}function ${name}() {}`;
            })
            .join('\n');
          sourceCode = fnDefs;
        }

        if (!sourceCode) {
          return {
            content: [{ type: 'text' as const, text: 'No source code provided. Supply either code or filePath.' }],
            isError: true,
          };
        }

        const functions = parseFunctions(sourceCode);

        if (functions.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No function signatures found in the provided code. Ensure the code contains function declarations (e.g., `export function name()` or `export const name = () =>`).',
              },
            ],
          };
        }

        const testCode = generateTestCode(functions, framework);

        const sourceLabel = filePath ?? '(inline)';

        // Publish test generated event
        eventBus?.publish('test:generated', {
          filePath: sourceLabel,
          testCount: functions.length,
          framework,
        });

        // Persist to store
        store.saveGeneratedTest({
          sourceFilePath: sourceLabel,
          framework,
          testCount: functions.length,
          generatedCode: testCode,
        });

        const summary = [
          `// Generated ${functions.length} test suite(s) for ${language} using ${framework}`,
          `// Functions found: ${functions.map((f) => f.name).join(', ')}`,
          '',
          testCode,
        ].join('\n');

        return {
          content: [{ type: 'text' as const, text: summary }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating tests: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
