/**
 * SQLite storage layer for the Regex Builder MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface SavedPattern {
  id: number;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  testCases: unknown[];
  createdAt: string;
}

export interface RegexHistoryEntry {
  id: number;
  operation: string;
  pattern: string;
  flags: string;
  result: unknown;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface SavedPatternRow {
  id: number;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  testCases: string;
  createdAt: string;
}

interface RegexHistoryRow {
  id: number;
  operation: string;
  pattern: string;
  flags: string;
  result: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create saved_patterns and regex_history tables',
    up: `
      CREATE TABLE IF NOT EXISTS saved_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        pattern TEXT NOT NULL,
        flags TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        testCases TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS regex_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        pattern TEXT NOT NULL,
        flags TEXT NOT NULL DEFAULT '',
        result TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toSavedPattern(row: SavedPatternRow): SavedPattern {
  return {
    ...row,
    testCases: JSON.parse(row.testCases) as unknown[],
  };
}

function toRegexHistoryEntry(row: RegexHistoryRow): RegexHistoryEntry {
  return {
    ...row,
    result: JSON.parse(row.result) as unknown,
  };
}

// ── RegexStore ─────────────────────────────────────────────────────────

export class RegexStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'regex-builder',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Saved Patterns ────────────────────────────────────────────────

  savePattern(input: {
    name: string;
    pattern: string;
    flags: string;
    description: string;
    testCases?: unknown[];
  }): SavedPattern {
    const stmt = this.db.prepare(
      `INSERT INTO saved_patterns (name, pattern, flags, description, testCases)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         pattern = excluded.pattern,
         flags = excluded.flags,
         description = excluded.description,
         testCases = excluded.testCases`,
    );
    stmt.run(
      input.name,
      input.pattern,
      input.flags,
      input.description,
      JSON.stringify(input.testCases ?? []),
    );
    return this.getPattern(input.name)!;
  }

  getPattern(name: string): SavedPattern | undefined {
    const row = this.db
      .prepare('SELECT * FROM saved_patterns WHERE name = ?')
      .get(name) as SavedPatternRow | undefined;
    return row ? toSavedPattern(row) : undefined;
  }

  listPatterns(): SavedPattern[] {
    const rows = this.db
      .prepare('SELECT * FROM saved_patterns ORDER BY createdAt DESC')
      .all() as SavedPatternRow[];
    return rows.map(toSavedPattern);
  }

  deletePattern(name: string): boolean {
    const result = this.db
      .prepare('DELETE FROM saved_patterns WHERE name = ?')
      .run(name);
    return result.changes > 0;
  }

  // ── Regex History ─────────────────────────────────────────────────

  logOperation(input: {
    operation: string;
    pattern: string;
    flags: string;
    result: unknown;
  }): RegexHistoryEntry {
    const stmt = this.db.prepare(
      'INSERT INTO regex_history (operation, pattern, flags, result) VALUES (?, ?, ?, ?)',
    );
    const res = stmt.run(
      input.operation,
      input.pattern,
      input.flags,
      JSON.stringify(input.result),
    );
    const row = this.db
      .prepare('SELECT * FROM regex_history WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as RegexHistoryRow;
    return toRegexHistoryEntry(row);
  }

  listHistory(operation?: string, limit?: number): RegexHistoryEntry[] {
    let sql = 'SELECT * FROM regex_history';
    const params: unknown[] = [];

    if (operation) {
      sql += ' WHERE operation = ?';
      params.push(operation);
    }

    sql += ' ORDER BY createdAt DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as RegexHistoryRow[];
    return rows.map(toRegexHistoryEntry);
  }
}
