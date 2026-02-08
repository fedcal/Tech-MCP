/**
 * SQLite storage layer for the HTTP Client MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface RequestHistoryEntry {
  id: number;
  method: string;
  url: string;
  headers: Record<string, string> | null;
  body: string | null;
  statusCode: number | null;
  statusText: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface SavedRequest {
  id: number;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string> | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface RequestHistoryRow {
  id: number;
  method: string;
  url: string;
  headers: string | null;
  body: string | null;
  statusCode: number | null;
  statusText: string | null;
  responseHeaders: string | null;
  responseBody: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface SavedRequestRow {
  id: number;
  name: string;
  method: string;
  url: string;
  headers: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create request_history and saved_requests tables',
    up: `
      CREATE TABLE IF NOT EXISTS request_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        statusCode INTEGER,
        statusText TEXT,
        responseHeaders TEXT,
        responseBody TEXT,
        durationMs REAL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS saved_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function parseJsonOrNull(value: string | null): Record<string, string> | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return null;
  }
}

function toRequestHistoryEntry(row: RequestHistoryRow): RequestHistoryEntry {
  return {
    ...row,
    headers: parseJsonOrNull(row.headers),
    responseHeaders: parseJsonOrNull(row.responseHeaders),
  };
}

function toSavedRequest(row: SavedRequestRow): SavedRequest {
  return {
    ...row,
    headers: parseJsonOrNull(row.headers),
  };
}

// ── HttpStore ──────────────────────────────────────────────────────────

export class HttpStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'http-client',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // ── Request History ─────────────────────────────────────────────────

  logRequest(input: {
    method: string;
    url: string;
    headers?: Record<string, string> | null;
    body?: string | null;
    statusCode?: number | null;
    statusText?: string | null;
    responseHeaders?: Record<string, string> | null;
    responseBody?: string | null;
    durationMs?: number | null;
  }): RequestHistoryEntry {
    const stmt = this.db.prepare(
      `INSERT INTO request_history (method, url, headers, body, statusCode, statusText, responseHeaders, responseBody, durationMs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      input.method,
      input.url,
      input.headers ? JSON.stringify(input.headers) : null,
      input.body ?? null,
      input.statusCode ?? null,
      input.statusText ?? null,
      input.responseHeaders ? JSON.stringify(input.responseHeaders) : null,
      input.responseBody ?? null,
      input.durationMs ?? null,
    );
    return this.getHistoryEntry(Number(result.lastInsertRowid))!;
  }

  private getHistoryEntry(id: number): RequestHistoryEntry | undefined {
    const row = this.db
      .prepare('SELECT * FROM request_history WHERE id = ?')
      .get(id) as RequestHistoryRow | undefined;
    return row ? toRequestHistoryEntry(row) : undefined;
  }

  listHistory(limit?: number, urlPattern?: string): RequestHistoryEntry[] {
    const effectiveLimit = limit ?? 50;

    if (urlPattern) {
      const rows = this.db
        .prepare(
          'SELECT * FROM request_history WHERE url LIKE ? ORDER BY createdAt DESC LIMIT ?',
        )
        .all(`%${urlPattern}%`, effectiveLimit) as RequestHistoryRow[];
      return rows.map(toRequestHistoryEntry);
    }

    const rows = this.db
      .prepare('SELECT * FROM request_history ORDER BY createdAt DESC LIMIT ?')
      .all(effectiveLimit) as RequestHistoryRow[];
    return rows.map(toRequestHistoryEntry);
  }

  // ── Saved Requests ──────────────────────────────────────────────────

  saveRequest(input: {
    name: string;
    method: string;
    url: string;
    headers?: Record<string, string> | null;
    body?: string | null;
  }): SavedRequest {
    const existing = this.getSavedRequest(input.name);

    if (existing) {
      this.db
        .prepare(
          `UPDATE saved_requests SET method = ?, url = ?, headers = ?, body = ?, updatedAt = datetime('now') WHERE name = ?`,
        )
        .run(
          input.method,
          input.url,
          input.headers ? JSON.stringify(input.headers) : null,
          input.body ?? null,
          input.name,
        );
      return this.getSavedRequest(input.name)!;
    }

    const stmt = this.db.prepare(
      'INSERT INTO saved_requests (name, method, url, headers, body) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.name,
      input.method,
      input.url,
      input.headers ? JSON.stringify(input.headers) : null,
      input.body ?? null,
    );
    const row = this.db
      .prepare('SELECT * FROM saved_requests WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as SavedRequestRow | undefined;
    return row ? toSavedRequest(row) : this.getSavedRequest(input.name)!;
  }

  getSavedRequest(name: string): SavedRequest | undefined {
    const row = this.db
      .prepare('SELECT * FROM saved_requests WHERE name = ?')
      .get(name) as SavedRequestRow | undefined;
    return row ? toSavedRequest(row) : undefined;
  }

  listSavedRequests(): SavedRequest[] {
    const rows = this.db
      .prepare('SELECT * FROM saved_requests ORDER BY updatedAt DESC')
      .all() as SavedRequestRow[];
    return rows.map(toSavedRequest);
  }

  deleteSavedRequest(name: string): boolean {
    const result = this.db
      .prepare('DELETE FROM saved_requests WHERE name = ?')
      .run(name);
    return result.changes > 0;
  }
}
