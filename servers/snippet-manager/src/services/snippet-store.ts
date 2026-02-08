/**
 * SQLite storage layer for code snippets.
 * Uses @mcp-suite/database for connection and migration management.
 */

import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';
import type { CodeSnippet } from '@mcp-suite/core';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create snippets table',
    up: `
      CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        code TEXT NOT NULL,
        language TEXT NOT NULL,
        description TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
  },
];

interface SnippetRow {
  id: number;
  title: string;
  code: string;
  language: string;
  description: string | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

function rowToSnippet(row: SnippetRow): CodeSnippet {
  return {
    id: String(row.id),
    title: row.title,
    code: row.code,
    language: row.language,
    description: row.description ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SnippetStore {
  private db: ReturnType<typeof createDatabase>;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'snippet-manager',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  save(input: {
    title: string;
    code: string;
    language: string;
    description?: string;
    tags?: string[];
  }): CodeSnippet {
    const now = new Date().toISOString();
    const tags = JSON.stringify(input.tags ?? []);

    const result = this.db
      .prepare(
        `INSERT INTO snippets (title, code, language, description, tags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.title, input.code, input.language, input.description ?? null, tags, now, now);

    return this.getById(String(result.lastInsertRowid))!;
  }

  search(query: {
    keyword?: string;
    tag?: string;
    language?: string;
  }): CodeSnippet[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.keyword) {
      conditions.push('(title LIKE ? OR description LIKE ? OR code LIKE ?)');
      const pattern = `%${query.keyword}%`;
      params.push(pattern, pattern, pattern);
    }

    if (query.tag) {
      conditions.push('tags LIKE ?');
      params.push(`%"${query.tag}"%`);
    }

    if (query.language) {
      conditions.push('language = ?');
      params.push(query.language);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM snippets ${where} ORDER BY updatedAt DESC`;

    const rows = this.db.prepare(sql).all(...params) as SnippetRow[];
    return rows.map(rowToSnippet);
  }

  getById(id: string): CodeSnippet | null {
    const row = this.db
      .prepare('SELECT * FROM snippets WHERE id = ?')
      .get(Number(id)) as SnippetRow | undefined;

    return row ? rowToSnippet(row) : null;
  }

  deleteById(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM snippets WHERE id = ?')
      .run(Number(id));

    return result.changes > 0;
  }

  listTags(): Array<{ tag: string; count: number }> {
    const rows = this.db
      .prepare('SELECT tags FROM snippets')
      .all() as Array<{ tags: string }>;

    const tagCounts = new Map<string, number>();

    for (const row of rows) {
      const tags = JSON.parse(row.tags) as string[];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }
}
