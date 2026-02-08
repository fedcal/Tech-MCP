/**
 * SQLite storage layer for the Codebase Knowledge MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchRecord {
  id: number;
  query: string;
  directory: string;
  matchCount: number;
  results: unknown;
  createdAt: string;
}

export interface ModuleExplanation {
  id: number;
  modulePath: string;
  explanation: string;
  createdAt: string;
}

export interface ModuleVersion {
  id: number;
  modulePath: string;
  changeType: string;
  description: string;
  filesChanged: number;
  author: string | null;
  commitRef: string | null;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────────────

interface SearchRecordRow {
  id: number;
  query: string;
  directory: string;
  matchCount: number;
  results: string;
  createdAt: string;
}

interface ModuleExplanationRow {
  id: number;
  modulePath: string;
  explanation: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create search_history and module_explanations tables',
    up: `
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        directory TEXT NOT NULL,
        matchCount INTEGER NOT NULL DEFAULT 0,
        results TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS module_explanations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modulePath TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    description: 'Create module_versions table for change tracking',
    up: `
      CREATE TABLE IF NOT EXISTS module_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modulePath TEXT NOT NULL,
        changeType TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        filesChanged INTEGER NOT NULL DEFAULT 0,
        author TEXT,
        commitRef TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_module_versions_path ON module_versions(modulePath);
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function toSearchRecord(row: SearchRecordRow): SearchRecord {
  return {
    ...row,
    results: JSON.parse(row.results) as unknown,
  };
}

function toModuleExplanation(row: ModuleExplanationRow): ModuleExplanation {
  return { ...row };
}

// ── KnowledgeStore ─────────────────────────────────────────────────────────

export class KnowledgeStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'codebase-knowledge',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Search History ────────────────────────────────────────────────────────

  saveSearch(input: {
    query: string;
    directory: string;
    matchCount: number;
    results: unknown;
  }): SearchRecord {
    const stmt = this.db.prepare(
      'INSERT INTO search_history (query, directory, matchCount, results) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.query,
      input.directory,
      input.matchCount,
      JSON.stringify(input.results),
    );
    const row = this.db
      .prepare('SELECT * FROM search_history WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as SearchRecordRow;
    return toSearchRecord(row);
  }

  listSearches(limit?: number): SearchRecord[] {
    const sql = limit
      ? 'SELECT * FROM search_history ORDER BY createdAt DESC LIMIT ?'
      : 'SELECT * FROM search_history ORDER BY createdAt DESC';
    const rows = (limit
      ? this.db.prepare(sql).all(limit)
      : this.db.prepare(sql).all()) as SearchRecordRow[];
    return rows.map(toSearchRecord);
  }

  // ── Module Explanations ───────────────────────────────────────────────────

  saveExplanation(input: {
    modulePath: string;
    explanation: string;
  }): ModuleExplanation {
    const stmt = this.db.prepare(
      'INSERT INTO module_explanations (modulePath, explanation) VALUES (?, ?)',
    );
    const result = stmt.run(input.modulePath, input.explanation);
    const row = this.db
      .prepare('SELECT * FROM module_explanations WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ModuleExplanationRow;
    return toModuleExplanation(row);
  }

  getExplanation(modulePath: string): ModuleExplanation | undefined {
    const row = this.db
      .prepare('SELECT * FROM module_explanations WHERE modulePath = ? ORDER BY createdAt DESC LIMIT 1')
      .get(modulePath) as ModuleExplanationRow | undefined;
    return row ? toModuleExplanation(row) : undefined;
  }

  // ── Change Tracking ───────────────────────────────────────────────────────

  trackChange(input: {
    modulePath: string;
    changeType: string;
    description: string;
    filesChanged?: number;
    author?: string;
    commitRef?: string;
  }): ModuleVersion {
    const stmt = this.db.prepare(
      'INSERT INTO module_versions (modulePath, changeType, description, filesChanged, author, commitRef) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.modulePath,
      input.changeType,
      input.description,
      input.filesChanged ?? 0,
      input.author ?? null,
      input.commitRef ?? null,
    );
    return this.db
      .prepare('SELECT * FROM module_versions WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ModuleVersion;
  }

  getChangeHistory(modulePath: string, limit?: number): ModuleVersion[] {
    const sql = limit
      ? 'SELECT * FROM module_versions WHERE modulePath = ? ORDER BY createdAt DESC LIMIT ?'
      : 'SELECT * FROM module_versions WHERE modulePath = ? ORDER BY createdAt DESC';
    return (limit
      ? this.db.prepare(sql).all(modulePath, limit)
      : this.db.prepare(sql).all(modulePath)) as ModuleVersion[];
  }

  listRecentChanges(limit: number = 20): ModuleVersion[] {
    return this.db
      .prepare('SELECT * FROM module_versions ORDER BY createdAt DESC LIMIT ?')
      .all(limit) as ModuleVersion[];
  }
}
