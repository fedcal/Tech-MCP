/**
 * Tool: generate-erd
 * Generates an entity-relationship diagram in Mermaid erDiagram syntax.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Database from 'better-sqlite3';
import type { ExplorerStore } from '../services/explorer-store.js';

interface TableColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  nullable: boolean;
}

interface ForeignKey {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

function sqliteTypeToMermaid(sqliteType: string): string {
  const upper = sqliteType.toUpperCase();
  if (upper.includes('INT')) return 'int';
  if (upper.includes('TEXT') || upper.includes('CHAR') || upper.includes('CLOB')) return 'string';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'float';
  if (upper.includes('BLOB')) return 'blob';
  if (upper.includes('BOOL')) return 'boolean';
  if (upper.includes('DATE') || upper.includes('TIME')) return 'datetime';
  if (upper.includes('NUMERIC') || upper.includes('DECIMAL')) return 'decimal';
  return sqliteType || 'text';
}

export function registerGenerateErd(server: McpServer, store: ExplorerStore): void {
  server.tool(
    'generate-erd',
    'Generate an entity-relationship diagram in Mermaid erDiagram format from a SQLite database',
    {
      dbPath: z.string().describe('Path to the SQLite database file'),
    },
    async ({ dbPath }) => {
      try {
        const db = new Database(dbPath, { readonly: true });

        try {
          const tables = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .all() as Array<{ name: string }>;

          const tableColumns: Map<string, TableColumn[]> = new Map();
          const foreignKeys: ForeignKey[] = [];

          for (const table of tables) {
            // Get columns
            const rawColumns = db
              .prepare(`PRAGMA table_info("${table.name}")`)
              .all() as Array<{
              cid: number;
              name: string;
              type: string;
              notnull: number;
              dflt_value: string | null;
              pk: number;
            }>;

            tableColumns.set(
              table.name,
              rawColumns.map((col) => ({
                name: col.name,
                type: col.type,
                primaryKey: col.pk > 0,
                nullable: col.notnull === 0,
              })),
            );

            // Get foreign keys
            const rawForeignKeys = db
              .prepare(`PRAGMA foreign_key_list("${table.name}")`)
              .all() as Array<{
              id: number;
              seq: number;
              table: string;
              from: string;
              to: string;
              on_update: string;
              on_delete: string;
              match: string;
            }>;

            for (const fk of rawForeignKeys) {
              foreignKeys.push({
                fromTable: table.name,
                fromColumn: fk.from,
                toTable: fk.table,
                toColumn: fk.to,
              });
            }
          }

          // Build Mermaid diagram
          const lines: string[] = ['erDiagram'];

          // Add table definitions
          for (const [tableName, columns] of tableColumns) {
            lines.push(`    ${tableName} {`);
            for (const col of columns) {
              const mermaidType = sqliteTypeToMermaid(col.type);
              const markers: string[] = [];
              if (col.primaryKey) markers.push('PK');
              if (!col.nullable && !col.primaryKey) markers.push('');
              const markerStr = markers.filter(Boolean).length > 0 ? ` ${markers.filter(Boolean).join(',')}` : '';
              lines.push(`        ${mermaidType} ${col.name}${markerStr}`);
            }
            lines.push('    }');
          }

          // Add relationships
          for (const fk of foreignKeys) {
            lines.push(`    ${fk.toTable} ||--o{ ${fk.fromTable} : "${fk.toColumn} -> ${fk.fromColumn}"`);
          }

          const mermaidDiagram = lines.join('\n');

          const result = {
            dbPath,
            tableCount: tables.length,
            relationshipCount: foreignKeys.length,
            mermaid: mermaidDiagram,
          };

          // Persist the full schema exploration from the ERD generation
          const schemaForStore = Array.from(tableColumns.entries()).map(([name, columns]) => ({
            name,
            columns,
          }));
          store.saveExploration({
            dbPath,
            tableCount: tables.length,
            schema: schemaForStore as unknown as Record<string, unknown>[],
          });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } finally {
          db.close();
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate ERD: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
