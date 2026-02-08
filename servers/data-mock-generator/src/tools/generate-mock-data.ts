/**
 * Tool: generate-mock-data
 * Generates mock data rows based on a schema definition.
 * Cross-server: can fetch DB schema from db-schema-explorer via ClientManager.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { generators, getGenerator } from '../services/generators.js';
import type { MockStore } from '../services/mock-store.js';

function mapSqlTypeToGenerator(columnName: string, sqlType: string): string {
  const name = columnName.toLowerCase();
  // Name-based heuristics (only use generators that exist in the registry)
  if (name.includes('email')) return 'email';
  if (name.includes('phone')) return 'phone';
  if (name === 'first_name' || name === 'firstname') return 'firstName';
  if (name === 'last_name' || name === 'lastname') return 'lastName';
  if (name.includes('name')) return 'firstName';
  if (name.includes('address') || name.includes('street')) return 'address';
  if (name.includes('company')) return 'company';
  if (name.includes('url') || name.includes('website')) return 'url';
  if (name.includes('uuid') || name.includes('guid')) return 'uuid';
  if (name.includes('ip')) return 'ipv4';
  if (name.includes('color')) return 'hexColor';
  // SQL type-based fallback
  const t = sqlType.toUpperCase();
  if (t.includes('INT')) return 'integer';
  if (t.includes('REAL') || t.includes('FLOAT') || t.includes('DOUBLE')) return 'float';
  if (t.includes('BOOL')) return 'boolean';
  if (t.includes('DATE') || t.includes('TIME')) return 'date';
  return 'sentence';
}

export function registerGenerateMockData(server: McpServer, store: MockStore, clientManager?: McpClientManager): void {
  const validTypes = Object.keys(generators);

  server.tool(
    'generate-mock-data',
    'Generate mock data rows based on a schema. Optionally auto-detect schema from a SQLite database via db-schema-explorer.',
    {
      schema: z
        .array(
          z.object({
            field: z.string().describe('The field/column name'),
            type: z
              .string()
              .describe(
                `The generator type. One of: ${validTypes.join(', ')}`,
              ),
          }),
        )
        .optional()
        .describe('Array of field definitions (not needed if dbPath is provided)'),
      dbPath: z
        .string()
        .optional()
        .describe('Path to SQLite database; schema will be fetched from db-schema-explorer'),
      tableName: z
        .string()
        .optional()
        .describe('Table name to use from database (defaults to first table)'),
      count: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(10)
        .describe('Number of rows to generate (default: 10, max: 10000)'),
      name: z
        .string()
        .optional()
        .describe('Optional name for the generated dataset (used for storage)'),
    },
    async ({ schema, dbPath, tableName, count, name }) => {
      try {
        let resolvedSchema = schema ?? [];

        // Fetch schema from db-schema-explorer if dbPath provided
        if (dbPath && clientManager && resolvedSchema.length === 0) {
          const result = await clientManager.callTool('db-schema-explorer', 'explore-schema', { dbPath });
          const content = (result as { content: Array<{ type: string; text: string }> }).content;
          const dbSchema = JSON.parse(content[0].text);
          const tables = dbSchema.tables as Array<{ name: string; columns: Array<{ name: string; type: string; primaryKey: boolean }> }>;
          const table = tableName
            ? tables.find((t) => t.name === tableName)
            : tables[0];
          if (!table) {
            return {
              content: [{ type: 'text' as const, text: `Table '${tableName ?? '(none)'}' not found in database` }],
              isError: true,
            };
          }
          // Map SQL columns to generator types, skipping auto-increment primary keys
          resolvedSchema = table.columns
            .filter((col) => !col.primaryKey)
            .map((col) => ({
              field: col.name,
              type: mapSqlTypeToGenerator(col.name, col.type),
            }));
        }

        if (resolvedSchema.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No schema provided. Supply either schema array or dbPath.' }],
            isError: true,
          };
        }
        // Validate all generator types upfront
        const invalidTypes = resolvedSchema.filter((col) => !getGenerator(col.type));
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

        // Build the generator lookup for each field
        const fieldGenerators = resolvedSchema.map((col) => ({
          field: col.field,
          generate: getGenerator(col.type)!,
        }));

        // Generate rows
        const rows: Record<string, string | number | boolean>[] = [];
        for (let i = 0; i < count; i++) {
          const row: Record<string, string | number | boolean> = {};
          for (const fg of fieldGenerators) {
            row[fg.field] = fg.generate();
          }
          rows.push(row);
        }

        // Persist to store
        const sampleData = rows.slice(0, 5);
        store.saveDataset({
          name: name ?? `mock-data-${Date.now()}`,
          schema: resolvedSchema.map((s) => ({ field: s.field, type: s.type })),
          format: 'json',
          rowCount: rows.length,
          sampleData,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating mock data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
