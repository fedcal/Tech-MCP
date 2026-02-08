/**
 * SQLite store for dashboard aggregation cache with TTL support.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create cached_aggregations table',
    up: `
      CREATE TABLE cached_aggregations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aggregationType TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        data TEXT NOT NULL,
        ttlSeconds INTEGER NOT NULL DEFAULT 120,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        expiresAt TEXT NOT NULL
      );
      CREATE INDEX idx_agg_type ON cached_aggregations(aggregationType);
      CREATE INDEX idx_agg_key ON cached_aggregations(cacheKey);
      CREATE INDEX idx_agg_expires ON cached_aggregations(expiresAt);
    `,
  },
];

interface CachedRow {
  id: number;
  aggregationType: string;
  cacheKey: string;
  data: string;
  ttlSeconds: number;
  createdAt: string;
  expiresAt: string;
}

export class DashboardStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'dashboard-api',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  getCached(type: string, key: string): Record<string, unknown> | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM cached_aggregations
         WHERE aggregationType = ? AND cacheKey = ? AND expiresAt > datetime('now')
         ORDER BY createdAt DESC LIMIT 1`,
      )
      .get(type, key) as CachedRow | undefined;
    return row ? (JSON.parse(row.data) as Record<string, unknown>) : undefined;
  }

  setCache(
    type: string,
    key: string,
    data: Record<string, unknown>,
    ttlSeconds = 120,
  ): void {
    this.db
      .prepare(
        'DELETE FROM cached_aggregations WHERE aggregationType = ? AND cacheKey = ?',
      )
      .run(type, key);

    this.db
      .prepare(
        `INSERT INTO cached_aggregations (aggregationType, cacheKey, data, ttlSeconds, expiresAt)
         VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`,
      )
      .run(type, key, JSON.stringify(data), ttlSeconds, ttlSeconds);
  }

  invalidate(type?: string): number {
    if (type) {
      const result = this.db
        .prepare('DELETE FROM cached_aggregations WHERE aggregationType = ?')
        .run(type);
      return result.changes;
    }
    const result = this.db
      .prepare('DELETE FROM cached_aggregations')
      .run();
    return result.changes;
  }

  cleanExpired(): number {
    const result = this.db
      .prepare("DELETE FROM cached_aggregations WHERE expiresAt < datetime('now')")
      .run();
    return result.changes;
  }

  getCacheStats(): { total: number; byType: Record<string, number> } {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) as count FROM cached_aggregations')
      .get() as { count: number };

    const typeRows = this.db
      .prepare(
        'SELECT aggregationType, COUNT(*) as count FROM cached_aggregations GROUP BY aggregationType',
      )
      .all() as Array<{ aggregationType: string; count: number }>;

    const byType: Record<string, number> = {};
    for (const row of typeRows) {
      byType[row.aggregationType] = row.count;
    }

    return { total: totalRow.count, byType };
  }
}
