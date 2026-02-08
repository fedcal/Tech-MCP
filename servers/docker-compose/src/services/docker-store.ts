/**
 * SQLite storage layer for the Docker Compose MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface ComposeAnalysis {
  id: number;
  filePath: string;
  serviceCount: number;
  services: string[];
  createdAt: string;
}

export interface GeneratedCompose {
  id: number;
  name: string;
  services: string[];
  output: string;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface ComposeAnalysisRow {
  id: number;
  filePath: string;
  serviceCount: number;
  services: string;
  createdAt: string;
}

interface GeneratedComposeRow {
  id: number;
  name: string;
  services: string;
  output: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create compose_analyses and generated_composes tables',
    up: `
      CREATE TABLE IF NOT EXISTS compose_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        serviceCount INTEGER NOT NULL,
        services TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS generated_composes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        services TEXT NOT NULL DEFAULT '[]',
        output TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toComposeAnalysis(row: ComposeAnalysisRow): ComposeAnalysis {
  return {
    ...row,
    services: JSON.parse(row.services) as string[],
  };
}

function toGeneratedCompose(row: GeneratedComposeRow): GeneratedCompose {
  return {
    ...row,
    services: JSON.parse(row.services) as string[],
  };
}

// ── DockerStore ─────────────────────────────────────────────────────────

export class DockerStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'docker-compose',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Compose Analyses ──────────────────────────────────────────────────

  saveAnalysis(input: {
    filePath: string;
    serviceCount: number;
    services: string[];
  }): ComposeAnalysis {
    const stmt = this.db.prepare(
      'INSERT INTO compose_analyses (filePath, serviceCount, services) VALUES (?, ?, ?)',
    );
    const result = stmt.run(
      input.filePath,
      input.serviceCount,
      JSON.stringify(input.services),
    );
    return this.getAnalysis(Number(result.lastInsertRowid))!;
  }

  getAnalysis(id: number): ComposeAnalysis | undefined {
    const row = this.db
      .prepare('SELECT * FROM compose_analyses WHERE id = ?')
      .get(id) as ComposeAnalysisRow | undefined;
    return row ? toComposeAnalysis(row) : undefined;
  }

  listAnalyses(limit?: number): ComposeAnalysis[] {
    const effectiveLimit = limit ?? 50;
    const rows = this.db
      .prepare('SELECT * FROM compose_analyses ORDER BY createdAt DESC LIMIT ?')
      .all(effectiveLimit) as ComposeAnalysisRow[];
    return rows.map(toComposeAnalysis);
  }

  // ── Generated Composes ────────────────────────────────────────────────

  saveGenerated(input: {
    name: string;
    services: string[];
    output: string;
  }): GeneratedCompose {
    const stmt = this.db.prepare(
      'INSERT INTO generated_composes (name, services, output) VALUES (?, ?, ?)',
    );
    const result = stmt.run(
      input.name,
      JSON.stringify(input.services),
      input.output,
    );
    return this.getGenerated(Number(result.lastInsertRowid))!;
  }

  getGenerated(id: number): GeneratedCompose | undefined {
    const row = this.db
      .prepare('SELECT * FROM generated_composes WHERE id = ?')
      .get(id) as GeneratedComposeRow | undefined;
    return row ? toGeneratedCompose(row) : undefined;
  }

  listGenerated(limit?: number): GeneratedCompose[] {
    const effectiveLimit = limit ?? 50;
    const rows = this.db
      .prepare('SELECT * FROM generated_composes ORDER BY createdAt DESC LIMIT ?')
      .all(effectiveLimit) as GeneratedComposeRow[];
    return rows.map(toGeneratedCompose);
  }
}
