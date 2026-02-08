/**
 * Tool: get-env-vars
 * Parses and returns variables from a .env file, masking secret values.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseEnvFile, maskValue } from '../services/env-parser.js';
import type { EnvStore } from '../services/env-store.js';

export function registerGetEnvVars(server: McpServer, store: EnvStore): void {
  server.tool(
    'get-env-vars',
    'Parse and return variables from a .env file with secret values masked',
    {
      filePath: z.string().describe('Path to the .env file to parse'),
      showSecrets: z
        .boolean()
        .optional()
        .describe('Whether to show secret values unmasked (default: false)'),
      filter: z
        .string()
        .optional()
        .describe('Filter variables by key name (case-insensitive substring match)'),
    },
    async ({ filePath, showSecrets, filter }) => {
      try {
        const parsed = parseEnvFile(filePath);

        if (parsed.errors.length > 0 && parsed.variables.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to parse .env file:\n${parsed.errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        let variables = parsed.variables;

        // Apply filter if provided
        if (filter) {
          const lowerFilter = filter.toLowerCase();
          variables = variables.filter((v) =>
            v.key.toLowerCase().includes(lowerFilter),
          );
        }

        // Mask secret values unless showSecrets is true
        const outputVariables = variables.map((v) => ({
          key: v.key,
          value: v.isSecret && !showSecrets ? maskValue(v.value) : v.value,
          isSecret: v.isSecret,
          line: v.line,
          ...(v.comment ? { comment: v.comment } : {}),
        }));

        const summary = {
          filePath: parsed.filePath,
          fileName: parsed.fileName,
          totalVariables: parsed.variables.length,
          secretsCount: parsed.variables.filter((v) => v.isSecret).length,
          filteredCount: outputVariables.length,
          ...(filter ? { filter } : {}),
          variables: outputVariables,
          ...(parsed.errors.length > 0 ? { warnings: parsed.errors } : {}),
        };

        // Persist snapshot with masked variables
        const maskedVars = parsed.variables.map((v) => ({
          key: v.key,
          value: v.isSecret ? maskValue(v.value) : v.value,
          isSecret: v.isSecret,
        }));
        store.saveSnapshot({
          envName: parsed.fileName,
          filePath: parsed.filePath,
          variableCount: parsed.variables.length,
          variables: maskedVars,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error reading .env file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
