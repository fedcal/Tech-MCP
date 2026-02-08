/**
 * SQLite storage layer for the Environment Manager MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface EnvSnapshot {
  id: number;
  envName: string;
  filePath: string;
  variableCount: number;
  variables: Record<string, unknown>[];
  createdAt: string;
}

export interface EnvComparison {
  id: number;
  envA: string;
  envB: string;
  differences: Record<string, unknown>;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface EnvSnapshotRow {
  id: number;
  envName: string;
  filePath: string;
  variableCount: number;
  variables: string;
  createdAt: string;
}

interface EnvComparisonRow {
  id: number;
  envA: string;
  envB: string;
  differences: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create env_snapshots and env_comparisons tables',
    up: `
      CREATE TABLE IF NOT EXISTS env_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        envName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        variableCount INTEGER NOT NULL DEFAULT 0,
        variables TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS env_comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        envA TEXT NOT NULL,
        envB TEXT NOT NULL,
        differences TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toEnvSnapshot(row: EnvSnapshotRow): EnvSnapshot {
  return {
    ...row,
    variables: JSON.parse(row.variables) as Record<string, unknown>[],
  };
}

function toEnvComparison(row: EnvComparisonRow): EnvComparison {
  return {
    ...row,
    differences: JSON.parse(row.differences) as Record<string, unknown>,
  };
}

// ── EnvStore ───────────────────────────────────────────────────────────

export class EnvStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'environment-manager',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Snapshots ───────────────────────────────────────────────────────

  saveSnapshot(input: {
    envName: string;
    filePath: string;
    variableCount: number;
    variables: Record<string, unknown>[];
  }): EnvSnapshot {
    const stmt = this.db.prepare(
      'INSERT INTO env_snapshots (envName, filePath, variableCount, variables) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.envName,
      input.filePath,
      input.variableCount,
      JSON.stringify(input.variables),
    );
    const row = this.db
      .prepare('SELECT * FROM env_snapshots WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as EnvSnapshotRow;
    return toEnvSnapshot(row);
  }

  listSnapshots(envName?: string): EnvSnapshot[] {
    if (envName) {
      const rows = this.db
        .prepare('SELECT * FROM env_snapshots WHERE envName = ? ORDER BY createdAt DESC')
        .all(envName) as EnvSnapshotRow[];
      return rows.map(toEnvSnapshot);
    }
    const rows = this.db
      .prepare('SELECT * FROM env_snapshots ORDER BY createdAt DESC')
      .all() as EnvSnapshotRow[];
    return rows.map(toEnvSnapshot);
  }

  // ── Comparisons ─────────────────────────────────────────────────────

  saveComparison(input: {
    envA: string;
    envB: string;
    differences: Record<string, unknown>;
  }): EnvComparison {
    const stmt = this.db.prepare(
      'INSERT INTO env_comparisons (envA, envB, differences) VALUES (?, ?, ?)',
    );
    const result = stmt.run(
      input.envA,
      input.envB,
      JSON.stringify(input.differences),
    );
    const row = this.db
      .prepare('SELECT * FROM env_comparisons WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as EnvComparisonRow;
    return toEnvComparison(row);
  }

  listComparisons(): EnvComparison[] {
    const rows = this.db
      .prepare('SELECT * FROM env_comparisons ORDER BY createdAt DESC')
      .all() as EnvComparisonRow[];
    return rows.map(toEnvComparison);
  }
}
