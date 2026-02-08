/**
 * Tool: compare-environments
 * Compares variables between two .env files to find missing and different entries.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseEnvFile, maskValue } from '../services/env-parser.js';
import type { EnvStore } from '../services/env-store.js';

export function registerCompareEnvironments(server: McpServer, store: EnvStore): void {
  server.tool(
    'compare-environments',
    'Compare variables between two .env files and find missing or different values',
    {
      filePathA: z.string().describe('Path to the first .env file'),
      filePathB: z.string().describe('Path to the second .env file'),
      showValues: z
        .boolean()
        .optional()
        .describe('Whether to include values in output (secrets are still masked, default: false)'),
    },
    async ({ filePathA, filePathB, showValues }) => {
      try {
        const parsedA = parseEnvFile(filePathA);
        const parsedB = parseEnvFile(filePathB);

        const errors: string[] = [...parsedA.errors, ...parsedB.errors];

        if (
          (parsedA.errors.length > 0 && parsedA.variables.length === 0) ||
          (parsedB.errors.length > 0 && parsedB.variables.length === 0)
        ) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to parse one or more .env files:\n${errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        const mapA = new Map(parsedA.variables.map((v) => [v.key, v]));
        const mapB = new Map(parsedB.variables.map((v) => [v.key, v]));

        const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

        const onlyInA: string[] = [];
        const onlyInB: string[] = [];
        const different: Array<{
          key: string;
          valueA?: string;
          valueB?: string;
          isSecret: boolean;
        }> = [];
        const identical: string[] = [];

        for (const key of allKeys) {
          const varA = mapA.get(key);
          const varB = mapB.get(key);

          if (varA && !varB) {
            onlyInA.push(key);
          } else if (!varA && varB) {
            onlyInB.push(key);
          } else if (varA && varB) {
            if (varA.value !== varB.value) {
              const isSecret = varA.isSecret || varB.isSecret;
              const entry: {
                key: string;
                valueA?: string;
                valueB?: string;
                isSecret: boolean;
              } = { key, isSecret };

              if (showValues) {
                entry.valueA = isSecret ? maskValue(varA.value) : varA.value;
                entry.valueB = isSecret ? maskValue(varB.value) : varB.value;
              }

              different.push(entry);
            } else {
              identical.push(key);
            }
          }
        }

        const summary = {
          fileA: parsedA.fileName,
          fileB: parsedB.fileName,
          filePathA: parsedA.filePath,
          filePathB: parsedB.filePath,
          totalKeysA: parsedA.variables.length,
          totalKeysB: parsedB.variables.length,
          comparison: {
            identical: identical.length,
            different: different.length,
            onlyInA: onlyInA.length,
            onlyInB: onlyInB.length,
          },
          onlyInA: onlyInA.sort(),
          onlyInB: onlyInB.sort(),
          different: different.sort((a, b) => a.key.localeCompare(b.key)),
          identicalKeys: identical.sort(),
          ...(errors.length > 0 ? { warnings: errors } : {}),
        };

        // Persist comparison result
        store.saveComparison({
          envA: parsedA.fileName,
          envB: parsedB.fileName,
          differences: {
            identical: identical.length,
            different: different.length,
            onlyInA: onlyInA.length,
            onlyInB: onlyInB.length,
            differentKeys: different.map((d) => d.key),
            onlyInAKeys: onlyInA,
            onlyInBKeys: onlyInB,
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
              text: `Error comparing environments: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
