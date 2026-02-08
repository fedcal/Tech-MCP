import { describe, it, expect } from 'vitest';
import { createDatabase } from '../src/connection.js';
import { runMigrations, type Migration } from '../src/migrations.js';

describe('runMigrations', () => {
  it('should run migrations in order', () => {
    const db = createDatabase({ serverName: 'test', inMemory: true });
    const migrations: Migration[] = [
      { version: 1, description: 'Create users', up: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)' },
      { version: 2, description: 'Add email', up: 'ALTER TABLE users ADD COLUMN email TEXT' },
    ];
    runMigrations(db, migrations);

    // Verify both migrations applied
    const info = db.prepare("PRAGMA table_info('users')").all() as Array<{ name: string }>;
    const columns = info.map(c => c.name);
    expect(columns).toContain('name');
    expect(columns).toContain('email');
  });

  it('should be idempotent - skip already applied migrations', () => {
    const db = createDatabase({ serverName: 'test', inMemory: true });
    const migrations: Migration[] = [
      { version: 1, description: 'Create items', up: 'CREATE TABLE items (id INTEGER PRIMARY KEY)' },
    ];
    runMigrations(db, migrations);
    // Run again - should not throw
    runMigrations(db, migrations);

    const applied = db.prepare('SELECT version FROM _migrations').all() as Array<{ version: number }>;
    expect(applied).toHaveLength(1);
  });
});
