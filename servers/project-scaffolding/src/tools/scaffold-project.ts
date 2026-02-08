/**
 * Tool: scaffold-project
 * Generates project files from a built-in template.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { TEMPLATES, substitutePlaceholders } from '../services/templates.js';
import type { ScaffoldingStore } from '../services/scaffolding-store.js';

export function registerScaffoldProject(server: McpServer, store: ScaffoldingStore): void {
  server.tool(
    'scaffold-project',
    'Generate a full project directory structure from a built-in template with placeholder substitution',
    {
      template: z
        .string()
        .describe(
          'Template name (node-typescript, express-api, react-app, mcp-server)',
        ),
      projectName: z.string().describe('Name of the project'),
      outputDir: z
        .string()
        .describe('Absolute path to the output directory where the project will be created'),
      options: z
        .object({
          author: z.string().optional().describe('Author name'),
          description: z.string().optional().describe('Project description'),
          license: z.string().optional().describe('License identifier (e.g., MIT, ISC)'),
        })
        .optional()
        .describe('Optional project metadata'),
    },
    async ({ template, projectName, outputDir, options }) => {
      try {
        const templateDef = TEMPLATES[template];
        if (!templateDef) {
          const available = Object.keys(TEMPLATES).join(', ');
          return {
            content: [
              {
                type: 'text' as const,
                text: `Unknown template "${template}". Available templates: ${available}`,
              },
            ],
            isError: true,
          };
        }

        const values: Record<string, string> = {
          projectName,
          author: options?.author ?? '',
          description: options?.description ?? `A ${templateDef.description} project`,
          license: options?.license ?? 'MIT',
        };

        const projectDir = join(outputDir, projectName);
        const createdFiles: string[] = [];

        for (const [relativePath, content] of Object.entries(templateDef.files)) {
          const filePath = join(projectDir, relativePath);
          const dir = dirname(filePath);

          await mkdir(dir, { recursive: true });
          const processedContent = substitutePlaceholders(content, values);
          await writeFile(filePath, processedContent, 'utf-8');
          createdFiles.push(relativePath);
        }

        const result = {
          template: templateDef.name,
          projectName,
          outputDir: projectDir,
          filesCreated: createdFiles,
          totalFiles: createdFiles.length,
        };

        // Persist scaffolded project record
        store.logProject({
          projectName,
          templateName: templateDef.name,
          outputPath: projectDir,
          options: options ?? {},
          filesGenerated: createdFiles.length,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to scaffold project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
