/**
 * Tool: validate-env
 * Validates a .env file against a template (.env.example).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseEnvFile } from '../services/env-parser.js';
import type { EnvStore } from '../services/env-store.js';

export function registerValidateEnv(server: McpServer, store: EnvStore): void {
  server.tool(
    'validate-env',
    'Validate a .env file against a template (.env.example) to find missing or extra variables',
    {
      envFilePath: z.string().describe('Path to the .env file to validate'),
      templateFilePath: z
        .string()
        .describe('Path to the template file (e.g., .env.example)'),
      strict: z
        .boolean()
        .optional()
        .describe('Fail if .env has extra variables not in the template (default: false)'),
    },
    async ({ envFilePath, templateFilePath, strict }) => {
      try {
        const envParsed = parseEnvFile(envFilePath);
        const templateParsed = parseEnvFile(templateFilePath);

        const parseErrors: string[] = [];
        if (envParsed.errors.length > 0 && envParsed.variables.length === 0) {
          parseErrors.push(`Failed to parse .env file: ${envParsed.errors.join(', ')}`);
        }
        if (templateParsed.errors.length > 0 && templateParsed.variables.length === 0) {
          parseErrors.push(
            `Failed to parse template file: ${templateParsed.errors.join(', ')}`,
          );
        }

        if (parseErrors.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: parseErrors.join('\n'),
              },
            ],
            isError: true,
          };
        }

        const envKeys = new Set(envParsed.variables.map((v) => v.key));
        const templateKeys = new Set(templateParsed.variables.map((v) => v.key));

        // Variables in template but missing from .env
        const missing = templateParsed.variables
          .filter((v) => !envKeys.has(v.key))
          .map((v) => ({
            key: v.key,
            templateValue: v.value || undefined,
            comment: v.comment || undefined,
          }));

        // Variables in .env but not in template
        const extra = envParsed.variables
          .filter((v) => !templateKeys.has(v.key))
          .map((v) => v.key);

        // Variables with empty values in .env
        const emptyValues = envParsed.variables
          .filter((v) => templateKeys.has(v.key) && v.value === '')
          .map((v) => v.key);

        const isValid =
          missing.length === 0 &&
          emptyValues.length === 0 &&
          (!strict || extra.length === 0);

        const issues: string[] = [];
        if (missing.length > 0) {
          issues.push(`${missing.length} required variable(s) missing from .env`);
        }
        if (emptyValues.length > 0) {
          issues.push(`${emptyValues.length} variable(s) have empty values`);
        }
        if (strict && extra.length > 0) {
          issues.push(
            `${extra.length} variable(s) in .env not defined in template (strict mode)`,
          );
        }

        const summary = {
          valid: isValid,
          envFile: envParsed.fileName,
          templateFile: templateParsed.fileName,
          envFilePath: envParsed.filePath,
          templateFilePath: templateParsed.filePath,
          totalEnvVars: envParsed.variables.length,
          totalTemplateVars: templateParsed.variables.length,
          ...(issues.length > 0 ? { issues } : {}),
          missing,
          extra: extra.sort(),
          emptyValues: emptyValues.sort(),
          ...(envParsed.errors.length > 0 || templateParsed.errors.length > 0
            ? {
                warnings: [
                  ...envParsed.errors.map((e) => `[env] ${e}`),
                  ...templateParsed.errors.map((e) => `[template] ${e}`),
                ],
              }
            : {}),
        };

        // Persist snapshot of the validated env file
        store.saveSnapshot({
          envName: envParsed.fileName,
          filePath: envParsed.filePath,
          variableCount: envParsed.variables.length,
          variables: envParsed.variables.map((v) => ({
            key: v.key,
            isSecret: v.isSecret,
          })),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error validating .env file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
