/**
 * Tool: list-templates
 * Lists all available built-in project templates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TEMPLATES } from '../services/templates.js';

export function registerListTemplates(server: McpServer): void {
  server.tool(
    'list-templates',
    'List all available built-in project templates with their names, descriptions, and file structures',
    {},
    async () => {
      try {
        const templates = Object.values(TEMPLATES).map((template) => ({
          name: template.name,
          description: template.description,
          files: Object.keys(template.files),
        }));

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(templates, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
