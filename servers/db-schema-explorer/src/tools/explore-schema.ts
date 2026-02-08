/**
 * Tool: explore-schema
 * Explores a SQLite database schema, returning all tables and their columns.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Database from 'better-sqlite3';
import type { ExplorerStore } from '../services/explorer-store.js';

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

interface TableSchema {
  name: string;
  columns: ColumnInfo[];
}

export function registerExploreSchema(server: McpServer, store: ExplorerStore): void {
  server.tool(
    'explore-schema',
    'Explore a SQLite database schema, returning all tables and their columns',
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

          const schema: TableSchema[] = tables.map((table) => {
            const columns = db
              .prepare(`PRAGMA table_info("${table.name}")`)
              .all() as Array<{
              cid: number;
              name: string;
              type: string;
              notnull: number;
              dflt_value: string | null;
              pk: number;
            }>;

            return {
              name: table.name,
              columns: columns.map((col) => ({
                name: col.name,
                type: col.type,
                nullable: col.notnull === 0,
                primaryKey: col.pk > 0,
              })),
            };
          });

          const result = {
            dbPath,
            tableCount: schema.length,
            tables: schema,
          };

          // Persist exploration result
          store.saveExploration({
            dbPath,
            tableCount: schema.length,
            schema: schema as unknown as Record<string, unknown>[],
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
              text: `Failed to explore schema: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
