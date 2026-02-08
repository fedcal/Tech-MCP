/**
 * SQLite storage layer for the Dependency Manager MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// -- Types ------------------------------------------------------------------

export interface VulnerabilityScan {
  id: number;
  projectPath: string;
  vulnerabilityCount: number;
  criticalCount: number;
  highCount: number;
  results: string;
  scannedAt: string;
}

export interface LicenseAudit {
  id: number;
  projectPath: string;
  packageCount: number;
  results: string;
  auditedAt: string;
}

// -- Raw row types (as stored in SQLite) ------------------------------------

interface VulnerabilityScanRow {
  id: number;
  projectPath: string;
  vulnerabilityCount: number;
  criticalCount: number;
  highCount: number;
  results: string;
  scannedAt: string;
}

interface LicenseAuditRow {
  id: number;
  projectPath: string;
  packageCount: number;
  results: string;
  auditedAt: string;
}

// -- Migrations -------------------------------------------------------------

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create vulnerability_scans and license_audits tables',
    up: `
      CREATE TABLE IF NOT EXISTS vulnerability_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectPath TEXT NOT NULL,
        vulnerabilityCount INTEGER NOT NULL DEFAULT 0,
        criticalCount INTEGER NOT NULL DEFAULT 0,
        highCount INTEGER NOT NULL DEFAULT 0,
        results TEXT NOT NULL DEFAULT '[]',
        scannedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS license_audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectPath TEXT NOT NULL,
        packageCount INTEGER NOT NULL DEFAULT 0,
        results TEXT NOT NULL DEFAULT '[]',
        auditedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// -- Helpers ----------------------------------------------------------------

function toScan(row: VulnerabilityScanRow): VulnerabilityScan {
  return { ...row };
}

function toAudit(row: LicenseAuditRow): LicenseAudit {
  return { ...row };
}

// -- DependencyStore --------------------------------------------------------

export class DependencyStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'dependency-manager',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // -- Vulnerability Scans ------------------------------------------------

  saveScan(input: {
    projectPath: string;
    vulnerabilityCount: number;
    criticalCount: number;
    highCount: number;
    results: string;
  }): VulnerabilityScan {
    const stmt = this.db.prepare(
      'INSERT INTO vulnerability_scans (projectPath, vulnerabilityCount, criticalCount, highCount, results) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.projectPath,
      input.vulnerabilityCount,
      input.criticalCount,
      input.highCount,
      input.results,
    );
    const row = this.db
      .prepare('SELECT * FROM vulnerability_scans WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as VulnerabilityScanRow;
    return toScan(row);
  }

  getLatestScan(projectPath: string): VulnerabilityScan | undefined {
    const row = this.db
      .prepare(
        'SELECT * FROM vulnerability_scans WHERE projectPath = ? ORDER BY scannedAt DESC LIMIT 1',
      )
      .get(projectPath) as VulnerabilityScanRow | undefined;
    return row ? toScan(row) : undefined;
  }

  listScans(limit = 50): VulnerabilityScan[] {
    const rows = this.db
      .prepare('SELECT * FROM vulnerability_scans ORDER BY scannedAt DESC LIMIT ?')
      .all(limit) as VulnerabilityScanRow[];
    return rows.map(toScan);
  }

  // -- License Audits -----------------------------------------------------

  saveLicenseAudit(input: {
    projectPath: string;
    packageCount: number;
    results: string;
  }): LicenseAudit {
    const stmt = this.db.prepare(
      'INSERT INTO license_audits (projectPath, packageCount, results) VALUES (?, ?, ?)',
    );
    const result = stmt.run(input.projectPath, input.packageCount, input.results);
    const row = this.db
      .prepare('SELECT * FROM license_audits WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as LicenseAuditRow;
    return toAudit(row);
  }

  listAudits(limit = 50): LicenseAudit[] {
    const rows = this.db
      .prepare('SELECT * FROM license_audits ORDER BY auditedAt DESC LIMIT ?')
      .all(limit) as LicenseAuditRow[];
    return rows.map(toAudit);
  }
}
