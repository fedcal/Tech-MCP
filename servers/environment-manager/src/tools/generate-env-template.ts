/**
 * Tool: generate-env-template
 * Generates a .env.example template from an existing .env file.
 * Strips values (keeping keys) and preserves comments.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnvFile } from '../services/env-parser.js';
import type { EnvStore } from '../services/env-store.js';

export function registerGenerateEnvTemplate(server: McpServer, store: EnvStore): void {
  server.tool(
    'generate-env-template',
    'Generate a .env.example template from an existing .env file (strip values, keep keys and comments)',
    {
      sourceFilePath: z.string().describe('Path to the source .env file'),
      outputFilePath: z
        .string()
        .optional()
        .describe(
          'Path for the output template file (default: .env.example in same directory)',
        ),
      preserveDefaults: z
        .boolean()
        .optional()
        .describe(
          'Keep non-secret values as defaults in the template (default: false)',
        ),
      addDescriptions: z
        .boolean()
        .optional()
        .describe(
          'Add # required/# optional comments based on whether value is empty (default: true)',
        ),
    },
    async ({ sourceFilePath, outputFilePath, preserveDefaults, addDescriptions }) => {
      try {
        const parsed = parseEnvFile(sourceFilePath);

        if (parsed.errors.length > 0 && parsed.variables.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to parse source .env file:\n${parsed.errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        const shouldAddDescriptions = addDescriptions !== false;

        // Build template content
        const lines: string[] = [];
        lines.push('# Environment Variables Template');
        lines.push(`# Generated from: ${parsed.fileName}`);
        lines.push(`# Date: ${new Date().toISOString()}`);
        lines.push('');

        // Preserve original comments
        if (parsed.comments.length > 0) {
          for (const comment of parsed.comments) {
            lines.push(`# ${comment}`);
          }
          lines.push('');
        }

        for (const variable of parsed.variables) {
          // Add description comment
          if (shouldAddDescriptions && variable.isSecret) {
            lines.push(`# ${variable.key} - secret value, do not commit`);
          } else if (shouldAddDescriptions && variable.comment) {
            lines.push(`# ${variable.comment}`);
          }

          // Determine template value
          let templateValue = '';
          if (preserveDefaults && !variable.isSecret) {
            templateValue = variable.value;
          }

          lines.push(`${variable.key}=${templateValue}`);
        }

        // Ensure trailing newline
        const templateContent = lines.join('\n') + '\n';

        // Determine output path
        const resolvedOutput =
          outputFilePath ||
          path.join(path.dirname(parsed.filePath), '.env.example');
        const resolvedOutputPath = path.resolve(resolvedOutput);

        // Write the template file
        fs.writeFileSync(resolvedOutputPath, templateContent, 'utf-8');

        const summary = {
          sourceFile: parsed.fileName,
          sourceFilePath: parsed.filePath,
          outputFilePath: resolvedOutputPath,
          totalVariables: parsed.variables.length,
          secretsStripped: parsed.variables.filter((v) => v.isSecret).length,
          defaultsPreserved: preserveDefaults || false,
          templatePreview: templateContent,
        };

        // Persist snapshot of the source env file
        store.saveSnapshot({
          envName: parsed.fileName,
          filePath: parsed.filePath,
          variableCount: parsed.variables.length,
          variables: parsed.variables.map((v) => ({
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
              text: `Error generating template: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
