/**
 * Simple migration runner for SQLite databases.
 */

import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  description: string;
  up: string;
}

export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db
    .prepare('SELECT version FROM _migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((m) => m.version));

  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, description) VALUES (?, ?)',
  );

  for (const migration of sorted) {
    if (appliedVersions.has(migration.version)) continue;

    db.exec(migration.up);
    insertMigration.run(migration.version, migration.description);
  }
}
