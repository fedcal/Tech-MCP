/**
 * SQLite store for RBAC/ABAC access control policies, roles, and audit logging.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

// ── Migrations ────────────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create policies, roles, role_assignments, and audit_log tables',
    up: `
      CREATE TABLE policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        effect TEXT NOT NULL CHECK(effect IN ('allow', 'deny')),
        rules TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      );

      CREATE TABLE role_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        roleId INTEGER NOT NULL,
        FOREIGN KEY (roleId) REFERENCES roles(id)
      );

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        server TEXT NOT NULL,
        tool TEXT NOT NULL,
        result TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_policies_name ON policies(name);
      CREATE INDEX idx_roles_name ON roles(name);
      CREATE INDEX idx_role_assignments_userId ON role_assignments(userId);
      CREATE INDEX idx_audit_log_userId ON audit_log(userId);
      CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
    `,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccessRule {
  server: string;
  tool?: string;
  roles: string[];
}

export interface Policy {
  id: number;
  name: string;
  effect: 'allow' | 'deny';
  rules: AccessRule[];
  createdAt: string;
}

export interface PolicyRow {
  id: number;
  name: string;
  effect: string;
  rules: string;
  createdAt: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

export interface RoleAssignment {
  id: number;
  userId: string;
  roleId: number;
}

export interface AuditEntry {
  id: number;
  userId: string;
  server: string;
  tool: string;
  result: string;
  reason: string;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    name: row.name,
    effect: row.effect as 'allow' | 'deny',
    rules: JSON.parse(row.rules) as AccessRule[],
    createdAt: row.createdAt,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class PolicyStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'access-policy',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Policy CRUD ───────────────────────────────────────────────────────────

  createPolicy(input: {
    name: string;
    effect: 'allow' | 'deny';
    rules: AccessRule[];
  }): Policy {
    const stmt = this.db.prepare(`
      INSERT INTO policies (name, effect, rules)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      input.name,
      input.effect,
      JSON.stringify(input.rules),
    );
    return this.getPolicy(Number(result.lastInsertRowid))!;
  }

  getPolicy(id: number): Policy | undefined {
    const row = this.db
      .prepare('SELECT * FROM policies WHERE id = ?')
      .get(id) as PolicyRow | undefined;
    return row ? rowToPolicy(row) : undefined;
  }

  getPolicyByName(name: string): Policy | undefined {
    const row = this.db
      .prepare('SELECT * FROM policies WHERE name = ?')
      .get(name) as PolicyRow | undefined;
    return row ? rowToPolicy(row) : undefined;
  }

  listPolicies(): Policy[] {
    const rows = this.db
      .prepare('SELECT * FROM policies ORDER BY createdAt DESC')
      .all() as PolicyRow[];
    return rows.map(rowToPolicy);
  }

  deletePolicy(id: number): boolean {
    const result = this.db
      .prepare('DELETE FROM policies WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  // ── Role management ───────────────────────────────────────────────────────

  createRole(name: string, description?: string): Role {
    const stmt = this.db.prepare(`
      INSERT INTO roles (name, description) VALUES (?, ?)
    `);
    const result = stmt.run(name, description ?? null);
    return this.getRole(Number(result.lastInsertRowid))!;
  }

  getRole(id: number): Role | undefined {
    return this.db
      .prepare('SELECT * FROM roles WHERE id = ?')
      .get(id) as Role | undefined;
  }

  getRoleByName(name: string): Role | undefined {
    return this.db
      .prepare('SELECT * FROM roles WHERE name = ?')
      .get(name) as Role | undefined;
  }

  listRoles(): Role[] {
    return this.db
      .prepare('SELECT * FROM roles ORDER BY name')
      .all() as Role[];
  }

  // ── Role assignments ──────────────────────────────────────────────────────

  assignRole(userId: string, roleId: number): void {
    // Avoid duplicate assignment
    const existing = this.db
      .prepare('SELECT id FROM role_assignments WHERE userId = ? AND roleId = ?')
      .get(userId, roleId);
    if (existing) return;

    this.db
      .prepare('INSERT INTO role_assignments (userId, roleId) VALUES (?, ?)')
      .run(userId, roleId);
  }

  removeRole(userId: string, roleId: number): void {
    this.db
      .prepare('DELETE FROM role_assignments WHERE userId = ? AND roleId = ?')
      .run(userId, roleId);
  }

  getUserRoles(userId: string): Role[] {
    return this.db
      .prepare(
        `SELECT r.* FROM roles r
         INNER JOIN role_assignments ra ON ra.roleId = r.id
         WHERE ra.userId = ?
         ORDER BY r.name`,
      )
      .all(userId) as Role[];
  }

  // ── Access check ──────────────────────────────────────────────────────────

  checkAccess(
    userId: string,
    server: string,
    tool?: string,
  ): { allowed: boolean; reason: string } {
    const userRoles = this.getUserRoles(userId);
    const roleNames = new Set(userRoles.map((r) => r.name));
    const policies = this.listPolicies();

    let hasAllow = false;
    let allowReason = '';

    for (const policy of policies) {
      for (const rule of policy.rules) {
        // Check if the rule matches the requested server
        if (rule.server !== server && rule.server !== '*') continue;

        // Check if the rule matches the requested tool (if specified)
        if (tool && rule.tool && rule.tool !== tool && rule.tool !== '*') continue;

        // If rule specifies a tool but request doesn't, still match
        // If rule doesn't specify a tool, it matches all tools

        // Check if any of the user's roles match the rule
        const hasMatchingRole = rule.roles.some((r) => roleNames.has(r));
        if (!hasMatchingRole) continue;

        // Deny takes precedence — return immediately
        if (policy.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by policy "${policy.name}"`,
          };
        }

        if (policy.effect === 'allow') {
          hasAllow = true;
          allowReason = `Allowed by policy "${policy.name}"`;
        }
      }
    }

    if (hasAllow) {
      return { allowed: true, reason: allowReason };
    }

    return { allowed: false, reason: 'No matching allow policy (default deny)' };
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  logAccess(
    userId: string,
    server: string,
    tool: string,
    result: string,
    reason: string,
  ): AuditEntry {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (userId, server, tool, result, reason)
      VALUES (?, ?, ?, ?, ?)
    `);
    const row = stmt.run(userId, server, tool, result, reason);
    return this.db
      .prepare('SELECT * FROM audit_log WHERE id = ?')
      .get(Number(row.lastInsertRowid)) as AuditEntry;
  }

  getAuditLog(filters?: {
    userId?: string;
    server?: string;
    limit?: number;
  }): AuditEntry[] {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.userId) {
      sql += ' AND userId = ?';
      params.push(filters.userId);
    }
    if (filters?.server) {
      sql += ' AND server = ?';
      params.push(filters.server);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db.prepare(sql).all(...params) as AuditEntry[];
  }
}
