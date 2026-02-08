import { describe, it, expect } from 'vitest';
import { createDatabase } from '../src/connection.js';

describe('createDatabase', () => {
  it('should create an in-memory database', () => {
    const db = createDatabase({ serverName: 'test', inMemory: true });
    expect(db).toBeDefined();
    // Verify it works
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    db.prepare('INSERT INTO test (id) VALUES (1)').run();
    const row = db.prepare('SELECT * FROM test').get() as { id: number };
    expect(row.id).toBe(1);
  });
});
