/**
 * SQLite database connection factory for MCP Suite servers.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_DATA_DIR = join(homedir(), '.mcp-suite', 'data');

export interface DatabaseOptions {
  serverName: string;
  dataDir?: string;
  inMemory?: boolean;
}

export function createDatabase(options: DatabaseOptions): Database.Database {
  if (options.inMemory) {
    return new Database(':memory:');
  }

  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, `${options.serverName}.db`);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}
