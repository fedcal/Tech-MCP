/**
 * SQLite store for MCP Server Registry.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create registered_servers and health_checks tables',
    up: `
      CREATE TABLE registered_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        transport TEXT NOT NULL DEFAULT 'stdio',
        capabilities TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'unknown',
        lastHealthCheck TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverId INTEGER NOT NULL,
        status TEXT NOT NULL,
        responseTimeMs INTEGER,
        error TEXT,
        checkedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (serverId) REFERENCES registered_servers(id)
      );

      CREATE INDEX idx_servers_status ON registered_servers(status);
      CREATE INDEX idx_servers_transport ON registered_servers(transport);
      CREATE INDEX idx_health_checks_server ON health_checks(serverId);
    `,
  },
];

export interface ServerRecord {
  id: number;
  name: string;
  url: string;
  transport: string;
  capabilities: string[];
  status: string;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServerRow {
  id: number;
  name: string;
  url: string;
  transport: string;
  capabilities: string;
  status: string;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckRecord {
  id: number;
  serverId: number;
  status: string;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: string;
}

function rowToServer(row: ServerRow): ServerRecord {
  return {
    ...row,
    capabilities: JSON.parse(row.capabilities) as string[],
  };
}

export class RegistryStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'mcp-registry',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  registerServer(input: {
    name: string;
    url: string;
    transport?: string;
    capabilities?: string[];
  }): ServerRecord {
    const stmt = this.db.prepare(`
      INSERT INTO registered_servers (name, url, transport, capabilities)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.name,
      input.url,
      input.transport ?? 'stdio',
      JSON.stringify(input.capabilities ?? []),
    );
    return this.getServer(Number(result.lastInsertRowid))!;
  }

  getServer(id: number): ServerRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM registered_servers WHERE id = ?')
      .get(id) as ServerRow | undefined;
    return row ? rowToServer(row) : undefined;
  }

  getServerByName(name: string): ServerRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM registered_servers WHERE name = ?')
      .get(name) as ServerRow | undefined;
    return row ? rowToServer(row) : undefined;
  }

  listServers(filters?: { status?: string; transport?: string }): ServerRecord[] {
    let sql = 'SELECT * FROM registered_servers WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.transport) {
      sql += ' AND transport = ?';
      params.push(filters.transport);
    }

    sql += ' ORDER BY createdAt DESC';

    const rows = this.db.prepare(sql).all(...params) as ServerRow[];
    return rows.map(rowToServer);
  }

  updateServerStatus(id: number, status: string): ServerRecord | undefined {
    this.db
      .prepare("UPDATE registered_servers SET status = ?, updatedAt = datetime('now') WHERE id = ?")
      .run(status, id);
    return this.getServer(id);
  }

  recordHealthCheck(input: {
    serverId: number;
    status: string;
    responseTimeMs?: number;
    error?: string;
  }): HealthCheckRecord {
    const stmt = this.db.prepare(`
      INSERT INTO health_checks (serverId, status, responseTimeMs, error)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.serverId,
      input.status,
      input.responseTimeMs ?? null,
      input.error ?? null,
    );

    // Update the server's lastHealthCheck and status
    this.db
      .prepare("UPDATE registered_servers SET status = ?, lastHealthCheck = datetime('now'), updatedAt = datetime('now') WHERE id = ?")
      .run(input.status, input.serverId);

    return this.db
      .prepare('SELECT * FROM health_checks WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as HealthCheckRecord;
  }

  getHealthHistory(serverId: number, limit?: number): HealthCheckRecord[] {
    let sql = 'SELECT * FROM health_checks WHERE serverId = ? ORDER BY checkedAt DESC';
    const params: unknown[] = [serverId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.db.prepare(sql).all(...params) as HealthCheckRecord[];
  }

  removeServer(id: number): boolean {
    // Delete associated health checks first
    this.db.prepare('DELETE FROM health_checks WHERE serverId = ?').run(id);
    const result = this.db.prepare('DELETE FROM registered_servers WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
