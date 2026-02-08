/**
 * SQLite store for insight-engine cached analyses with TTL support.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create cached_analyses table',
    up: `
      CREATE TABLE cached_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysisType TEXT NOT NULL,
        queryKey TEXT NOT NULL,
        result TEXT NOT NULL,
        ttlSeconds INTEGER NOT NULL DEFAULT 300,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        expiresAt TEXT NOT NULL
      );
      CREATE INDEX idx_cached_type ON cached_analyses(analysisType);
      CREATE INDEX idx_cached_key ON cached_analyses(queryKey);
      CREATE INDEX idx_cached_expires ON cached_analyses(expiresAt);
    `,
  },
];

export interface CachedAnalysis {
  id: number;
  analysisType: string;
  queryKey: string;
  result: string;
  ttlSeconds: number;
  createdAt: string;
  expiresAt: string;
}

export class InsightStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'insight-engine',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  getCachedAnalysis(type: string, queryKey: string): CachedAnalysis | undefined {
    return this.db
      .prepare(
        `SELECT * FROM cached_analyses
         WHERE analysisType = ? AND queryKey = ? AND expiresAt > datetime('now')
         ORDER BY createdAt DESC LIMIT 1`,
      )
      .get(type, queryKey) as CachedAnalysis | undefined;
  }

  cacheAnalysis(
    type: string,
    queryKey: string,
    result: Record<string, unknown>,
    ttlSeconds = 300,
  ): void {
    this.db
      .prepare(
        `INSERT INTO cached_analyses (analysisType, queryKey, result, ttlSeconds, expiresAt)
         VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`,
      )
      .run(type, queryKey, JSON.stringify(result), ttlSeconds, ttlSeconds);
  }

  invalidateCache(type?: string): number {
    if (type) {
      const result = this.db
        .prepare('DELETE FROM cached_analyses WHERE analysisType = ?')
        .run(type);
      return result.changes;
    }
    const result = this.db.prepare('DELETE FROM cached_analyses').run();
    return result.changes;
  }

  listCachedAnalyses(type?: string): CachedAnalysis[] {
    if (type) {
      return this.db
        .prepare('SELECT * FROM cached_analyses WHERE analysisType = ? ORDER BY createdAt DESC')
        .all(type) as CachedAnalysis[];
    }
    return this.db
      .prepare('SELECT * FROM cached_analyses ORDER BY createdAt DESC')
      .all() as CachedAnalysis[];
  }

  cleanExpired(): number {
    const result = this.db
      .prepare("DELETE FROM cached_analyses WHERE expiresAt <= datetime('now')")
      .run();
    return result.changes;
  }
}
