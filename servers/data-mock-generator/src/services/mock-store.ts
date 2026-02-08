/**
 * SQLite storage layer for the Data Mock Generator MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface GeneratedDataset {
  id: number;
  name: string;
  schema: Record<string, unknown>[];
  format: string;
  rowCount: number;
  sampleData: Record<string, unknown>[];
  createdAt: string;
}

export interface SavedSchema {
  id: number;
  name: string;
  description: string;
  fields: Record<string, unknown>[];
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface GeneratedDatasetRow {
  id: number;
  name: string;
  schema: string;
  format: string;
  rowCount: number;
  sampleData: string;
  createdAt: string;
}

interface SavedSchemaRow {
  id: number;
  name: string;
  description: string;
  fields: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create generated_datasets and saved_schemas tables',
    up: `
      CREATE TABLE IF NOT EXISTS generated_datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        schema TEXT NOT NULL DEFAULT '[]',
        format TEXT NOT NULL DEFAULT 'json',
        rowCount INTEGER NOT NULL DEFAULT 0,
        sampleData TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS saved_schemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        fields TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toGeneratedDataset(row: GeneratedDatasetRow): GeneratedDataset {
  return {
    ...row,
    schema: JSON.parse(row.schema) as Record<string, unknown>[],
    sampleData: JSON.parse(row.sampleData) as Record<string, unknown>[],
  };
}

function toSavedSchema(row: SavedSchemaRow): SavedSchema {
  return {
    ...row,
    fields: JSON.parse(row.fields) as Record<string, unknown>[],
  };
}

// ── MockStore ──────────────────────────────────────────────────────────

export class MockStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'data-mock-generator',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Generated Datasets ──────────────────────────────────────────────

  saveDataset(input: {
    name: string;
    schema: Record<string, unknown>[];
    format: string;
    rowCount: number;
    sampleData: Record<string, unknown>[];
  }): GeneratedDataset {
    const stmt = this.db.prepare(
      'INSERT INTO generated_datasets (name, schema, format, rowCount, sampleData) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.name,
      JSON.stringify(input.schema),
      input.format,
      input.rowCount,
      JSON.stringify(input.sampleData),
    );
    const row = this.db
      .prepare('SELECT * FROM generated_datasets WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as GeneratedDatasetRow;
    return toGeneratedDataset(row);
  }

  listDatasets(limit?: number): GeneratedDataset[] {
    const effectiveLimit = limit ?? 50;
    const rows = this.db
      .prepare('SELECT * FROM generated_datasets ORDER BY createdAt DESC LIMIT ?')
      .all(effectiveLimit) as GeneratedDatasetRow[];
    return rows.map(toGeneratedDataset);
  }

  // ── Saved Schemas ───────────────────────────────────────────────────

  saveSchema(input: {
    name: string;
    description: string;
    fields: Record<string, unknown>[];
  }): SavedSchema {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO saved_schemas (name, description, fields) VALUES (?, ?, ?)',
    );
    stmt.run(input.name, input.description, JSON.stringify(input.fields));
    const row = this.db
      .prepare('SELECT * FROM saved_schemas WHERE name = ?')
      .get(input.name) as SavedSchemaRow;
    return toSavedSchema(row);
  }

  getSchema(name: string): SavedSchema | undefined {
    const row = this.db
      .prepare('SELECT * FROM saved_schemas WHERE name = ?')
      .get(name) as SavedSchemaRow | undefined;
    return row ? toSavedSchema(row) : undefined;
  }

  listSchemas(): SavedSchema[] {
    const rows = this.db
      .prepare('SELECT * FROM saved_schemas ORDER BY createdAt DESC')
      .all() as SavedSchemaRow[];
    return rows.map(toSavedSchema);
  }
}
