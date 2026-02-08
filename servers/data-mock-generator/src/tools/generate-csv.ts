/**
 * Tool: generate-csv
 * Generates mock CSV data with a header row and configurable delimiter.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generators, getGenerator } from '../services/generators.js';
import type { MockStore } from '../services/mock-store.js';

/**
 * Escapes a CSV field value. Wraps the value in double quotes if it contains
 * the delimiter, a double quote, or a newline character.
 */
function escapeCsvField(value: string, delimiter: string): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function registerGenerateCsv(server: McpServer, store: MockStore): void {
  const validTypes = Object.keys(generators);

  server.tool(
    'generate-csv',
    'Generate mock data in CSV format with a header row and configurable delimiter',
    {
      columns: z
        .array(
          z.object({
            name: z.string().describe('The column header name'),
            type: z
              .string()
              .describe(
                `The generator type. One of: ${validTypes.join(', ')}`,
              ),
          }),
        )
        .describe('Array of column definitions'),
      count: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(10)
        .describe('Number of data rows to generate (default: 10, max: 10000)'),
      delimiter: z
        .string()
        .max(5)
        .default(',')
        .describe('Column delimiter character (default: ",")'),
      name: z
        .string()
        .optional()
        .describe('Optional name for the generated dataset (used for storage)'),
    },
    async ({ columns, count, delimiter, name }) => {
      try {
        // Validate all generator types
        const invalidTypes = columns.filter((col) => !getGenerator(col.type));
        if (invalidTypes.length > 0) {
          const unknownNames = invalidTypes.map((c) => c.type).join(', ');
          return {
            content: [
              {
                type: 'text' as const,
                text: `Unknown generator type(s): ${unknownNames}. Available types: ${validTypes.join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        // Build column generator lookup
        const columnGenerators = columns.map((col) => ({
          name: col.name,
          generate: getGenerator(col.type)!,
        }));

        // Build header row
        const headerRow = columnGenerators
          .map((cg) => escapeCsvField(cg.name, delimiter))
          .join(delimiter);

        // Build data rows
        const dataRows: string[] = [];
        for (let i = 0; i < count; i++) {
          const row = columnGenerators
            .map((cg) => escapeCsvField(String(cg.generate()), delimiter))
            .join(delimiter);
          dataRows.push(row);
        }

        const csv = [headerRow, ...dataRows].join('\n');

        // Persist to store
        store.saveDataset({
          name: name ?? `csv-data-${Date.now()}`,
          schema: columns.map((c) => ({ name: c.name, type: c.type })),
          format: 'csv',
          rowCount: count,
          sampleData: dataRows.slice(0, 5).map((row) => ({ row })),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: csv,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating CSV: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
