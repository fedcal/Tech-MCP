/**
 * SQLite storage layer for the API Documentation MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface ApiSpec {
  id: number;
  title: string;
  version: string;
  endpointCount: number;
  spec: Record<string, unknown>;
  createdAt: string;
}

export interface DocumentationIssue {
  id: number;
  filePath: string;
  issueType: string;
  details: string;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface ApiSpecRow {
  id: number;
  title: string;
  version: string;
  endpointCount: number;
  spec: string;
  createdAt: string;
}

interface DocumentationIssueRow {
  id: number;
  filePath: string;
  issueType: string;
  details: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create api_specs and documentation_issues tables',
    up: `
      CREATE TABLE IF NOT EXISTS api_specs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        version TEXT NOT NULL,
        endpointCount INTEGER NOT NULL DEFAULT 0,
        spec TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS documentation_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        issueType TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toApiSpec(row: ApiSpecRow): ApiSpec {
  return {
    ...row,
    spec: JSON.parse(row.spec) as Record<string, unknown>,
  };
}

function toDocumentationIssue(row: DocumentationIssueRow): DocumentationIssue {
  return { ...row };
}

// ── DocsStore ──────────────────────────────────────────────────────────

export class DocsStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'api-documentation',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── API Specs ─────────────────────────────────────────────────────

  saveSpec(input: {
    title: string;
    version: string;
    endpointCount: number;
    spec: Record<string, unknown>;
  }): ApiSpec {
    const stmt = this.db.prepare(
      'INSERT INTO api_specs (title, version, endpointCount, spec) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.title,
      input.version,
      input.endpointCount,
      JSON.stringify(input.spec),
    );
    const row = this.db
      .prepare('SELECT * FROM api_specs WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ApiSpecRow;
    return toApiSpec(row);
  }

  listSpecs(): ApiSpec[] {
    const rows = this.db
      .prepare('SELECT * FROM api_specs ORDER BY createdAt DESC')
      .all() as ApiSpecRow[];
    return rows.map(toApiSpec);
  }

  // ── Documentation Issues ──────────────────────────────────────────

  saveIssue(input: {
    filePath: string;
    issueType: string;
    details: string;
  }): DocumentationIssue {
    const stmt = this.db.prepare(
      'INSERT INTO documentation_issues (filePath, issueType, details) VALUES (?, ?, ?)',
    );
    const result = stmt.run(input.filePath, input.issueType, input.details);
    const row = this.db
      .prepare('SELECT * FROM documentation_issues WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as DocumentationIssueRow;
    return toDocumentationIssue(row);
  }

  listIssues(): DocumentationIssue[] {
    const rows = this.db
      .prepare('SELECT * FROM documentation_issues ORDER BY createdAt DESC')
      .all() as DocumentationIssueRow[];
    return rows.map(toDocumentationIssue);
  }
}
