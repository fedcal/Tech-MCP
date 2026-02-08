/**
 * SQLite storage layer for the DB Schema Explorer MCP server.
 * Persists exploration results and index suggestions for later retrieval.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

// -- Types ------------------------------------------------------------------

export interface Exploration {
  id: number;
  dbPath: string;
  tableCount: number;
  schema: Record<string, unknown>[];
  exploredAt: string;
}

export interface IndexSuggestion {
  id: number;
  dbPath: string;
  tableName: string;
  columns: string[];
  reason: string;
  createdAt: string;
}

// -- Raw row types (as stored in SQLite) ------------------------------------

interface ExplorationRow {
  id: number;
  dbPath: string;
  tableCount: number;
  schema: string;
  exploredAt: string;
}

interface IndexSuggestionRow {
  id: number;
  dbPath: string;
  tableName: string;
  columns: string;
  reason: string;
  createdAt: string;
}

// -- Migrations -------------------------------------------------------------

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create explored_databases and index_suggestions tables',
    up: `
      CREATE TABLE IF NOT EXISTS explored_databases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dbPath TEXT NOT NULL,
        tableCount INTEGER NOT NULL DEFAULT 0,
        schema TEXT NOT NULL DEFAULT '[]',
        exploredAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS index_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dbPath TEXT NOT NULL,
        tableName TEXT NOT NULL,
        columns TEXT NOT NULL DEFAULT '[]',
        reason TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// -- Helpers ----------------------------------------------------------------

function toExploration(row: ExplorationRow): Exploration {
  return {
    ...row,
    schema: JSON.parse(row.schema) as Record<string, unknown>[],
  };
}

function toIndexSuggestion(row: IndexSuggestionRow): IndexSuggestion {
  return {
    ...row,
    columns: JSON.parse(row.columns) as string[],
  };
}

// -- ExplorerStore ----------------------------------------------------------

export class ExplorerStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'db-schema-explorer',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // -- Explorations ---------------------------------------------------------

  saveExploration(input: {
    dbPath: string;
    tableCount: number;
    schema: Record<string, unknown>[];
  }): Exploration {
    const stmt = this.db.prepare(
      'INSERT INTO explored_databases (dbPath, tableCount, schema) VALUES (?, ?, ?)',
    );
    const result = stmt.run(input.dbPath, input.tableCount, JSON.stringify(input.schema));
    return this.getExplorationById(Number(result.lastInsertRowid))!;
  }

  getLatestExploration(dbPath: string): Exploration | undefined {
    const row = this.db
      .prepare('SELECT * FROM explored_databases WHERE dbPath = ? ORDER BY exploredAt DESC LIMIT 1')
      .get(dbPath) as ExplorationRow | undefined;
    return row ? toExploration(row) : undefined;
  }

  listExplorations(): Exploration[] {
    const rows = this.db
      .prepare('SELECT * FROM explored_databases ORDER BY exploredAt DESC')
      .all() as ExplorationRow[];
    return rows.map(toExploration);
  }

  // -- Index suggestions ----------------------------------------------------

  saveIndexSuggestion(input: {
    dbPath: string;
    tableName: string;
    columns: string[];
    reason: string;
  }): IndexSuggestion {
    const stmt = this.db.prepare(
      'INSERT INTO index_suggestions (dbPath, tableName, columns, reason) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.dbPath,
      input.tableName,
      JSON.stringify(input.columns),
      input.reason,
    );
    return this.getSuggestionById(Number(result.lastInsertRowid))!;
  }

  listSuggestions(dbPath?: string): IndexSuggestion[] {
    if (dbPath) {
      const rows = this.db
        .prepare('SELECT * FROM index_suggestions WHERE dbPath = ? ORDER BY createdAt DESC')
        .all(dbPath) as IndexSuggestionRow[];
      return rows.map(toIndexSuggestion);
    }
    const rows = this.db
      .prepare('SELECT * FROM index_suggestions ORDER BY createdAt DESC')
      .all() as IndexSuggestionRow[];
    return rows.map(toIndexSuggestion);
  }

  // -- Private helpers ------------------------------------------------------

  private getExplorationById(id: number): Exploration | undefined {
    const row = this.db
      .prepare('SELECT * FROM explored_databases WHERE id = ?')
      .get(id) as ExplorationRow | undefined;
    return row ? toExploration(row) : undefined;
  }

  private getSuggestionById(id: number): IndexSuggestion | undefined {
    const row = this.db
      .prepare('SELECT * FROM index_suggestions WHERE id = ?')
      .get(id) as IndexSuggestionRow | undefined;
    return row ? toIndexSuggestion(row) : undefined;
  }
}
