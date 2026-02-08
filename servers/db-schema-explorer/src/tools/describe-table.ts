/**
 * Tool: describe-table
 * Gets detailed information about a specific table including columns, indexes, foreign keys, and row count.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Database from 'better-sqlite3';
import type { ExplorerStore } from '../services/explorer-store.js';

interface ColumnDetail {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

interface IndexDetail {
  name: string;
  unique: boolean;
  columns: string[];
}

interface ForeignKeyDetail {
  id: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
}

export function registerDescribeTable(server: McpServer, store: ExplorerStore): void {
  server.tool(
    'describe-table',
    'Get detailed information about a specific table including columns, indexes, foreign keys, and row count',
    {
      dbPath: z.string().describe('Path to the SQLite database file'),
      tableName: z.string().describe('Name of the table to describe'),
    },
    async ({ dbPath, tableName }) => {
      try {
        const db = new Database(dbPath, { readonly: true });

        try {
          // Verify the table exists
          const tableExists = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            )
            .get(tableName) as { name: string } | undefined;

          if (!tableExists) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Table "${tableName}" not found in the database.`,
                },
              ],
              isError: true,
            };
          }

          // Get columns
          const rawColumns = db
            .prepare(`PRAGMA table_info("${tableName}")`)
            .all() as Array<{
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          }>;

          const columns: ColumnDetail[] = rawColumns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            primaryKey: col.pk > 0,
            defaultValue: col.dflt_value,
          }));

          // Get indexes
          const rawIndexes = db
            .prepare(`PRAGMA index_list("${tableName}")`)
            .all() as Array<{
            seq: number;
            name: string;
            unique: number;
            origin: string;
            partial: number;
          }>;

          const indexes: IndexDetail[] = rawIndexes.map((idx) => {
            const indexColumns = db
              .prepare(`PRAGMA index_info("${idx.name}")`)
              .all() as Array<{
              seqno: number;
              cid: number;
              name: string;
            }>;

            return {
              name: idx.name,
              unique: idx.unique === 1,
              columns: indexColumns.map((col) => col.name),
            };
          });

          // Get foreign keys
          const rawForeignKeys = db
            .prepare(`PRAGMA foreign_key_list("${tableName}")`)
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

          const foreignKeys: ForeignKeyDetail[] = rawForeignKeys.map((fk) => ({
            id: fk.id,
            table: fk.table,
            from: fk.from,
            to: fk.to,
            onUpdate: fk.on_update,
            onDelete: fk.on_delete,
          }));

          // Get row count
          const countResult = db
            .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
            .get() as { count: number };

          const result = {
            dbPath,
            tableName,
            rowCount: countResult.count,
            columns,
            indexes,
            foreignKeys,
          };

          // Persist single-table exploration as a schema snapshot
          store.saveExploration({
            dbPath,
            tableCount: 1,
            schema: [{ name: tableName, columns, indexes, foreignKeys, rowCount: countResult.count }] as unknown as Record<string, unknown>[],
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
              text: `Failed to describe table: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
