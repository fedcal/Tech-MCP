/**
 * Tool: suggest-indexes
 * Analyzes table structures and suggests missing indexes for better query performance.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Database from 'better-sqlite3';
import type { EventBus } from '@mcp-suite/core';
import type { ExplorerStore } from '../services/explorer-store.js';

interface IndexSuggestion {
  table: string;
  column: string;
  reason: string;
  suggestedSql: string;
}

export function registerSuggestIndexes(server: McpServer, eventBus?: EventBus, store?: ExplorerStore): void {
  server.tool(
    'suggest-indexes',
    'Analyze table structures and suggest missing indexes for better query performance',
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

          const suggestions: IndexSuggestion[] = [];

          for (const table of tables) {
            // Get existing indexes and their columns
            const rawIndexes = db
              .prepare(`PRAGMA index_list("${table.name}")`)
              .all() as Array<{
              seq: number;
              name: string;
              unique: number;
              origin: string;
              partial: number;
            }>;

            const indexedColumns = new Set<string>();
            for (const idx of rawIndexes) {
              const indexColumns = db
                .prepare(`PRAGMA index_info("${idx.name}")`)
                .all() as Array<{
                seqno: number;
                cid: number;
                name: string;
              }>;
              for (const col of indexColumns) {
                indexedColumns.add(col.name);
              }
            }

            // Check for foreign key columns without indexes
            const foreignKeys = db
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

            for (const fk of foreignKeys) {
              if (!indexedColumns.has(fk.from)) {
                suggestions.push({
                  table: table.name,
                  column: fk.from,
                  reason: `Foreign key column referencing "${fk.table}"("${fk.to}") is not indexed. Adding an index improves JOIN and DELETE performance.`,
                  suggestedSql: `CREATE INDEX idx_${table.name}_${fk.from} ON "${table.name}"("${fk.from}");`,
                });
              }
            }

            // Check for large tables without any indexes (excluding primary key auto-index)
            const userIndexes = rawIndexes.filter((idx) => idx.origin !== 'pk');
            if (userIndexes.length === 0) {
              const countResult = db
                .prepare(`SELECT COUNT(*) as count FROM "${table.name}"`)
                .get() as { count: number };

              if (countResult.count > 1000) {
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

                const nonPkColumns = columns.filter((col) => col.pk === 0);
                if (nonPkColumns.length > 0) {
                  suggestions.push({
                    table: table.name,
                    column: '*',
                    reason: `Table has ${countResult.count} rows but no user-defined indexes. Consider adding indexes on frequently queried columns.`,
                    suggestedSql: `-- Analyze query patterns and add indexes on frequently filtered/sorted columns of "${table.name}"`,
                  });
                }
              }
            }
          }

          // Publish index suggestion events
          for (const suggestion of suggestions) {
            eventBus?.publish('db:index-suggestion', {
              database: dbPath,
              table: suggestion.table,
              columns: [suggestion.column],
              reason: suggestion.reason,
            });
          }

          // Persist index suggestions to store
          if (store) {
            for (const suggestion of suggestions) {
              store.saveIndexSuggestion({
                dbPath,
                tableName: suggestion.table,
                columns: [suggestion.column],
                reason: suggestion.reason,
              });
            }
          }

          const result = {
            dbPath,
            tablesAnalyzed: tables.length,
            suggestionsCount: suggestions.length,
            suggestions,
          };

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
              text: `Failed to suggest indexes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
