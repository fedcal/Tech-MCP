/**
 * SQLite store for Quality Gates.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create gates and gate_evaluations tables',
    up: `
      CREATE TABLE gates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        projectName TEXT,
        checks TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE gate_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateId INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        results TEXT NOT NULL DEFAULT '{}',
        failures TEXT NOT NULL DEFAULT '[]',
        evaluatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (gateId) REFERENCES gates(id)
      );

      CREATE INDEX idx_gate_evaluations_gate ON gate_evaluations(gateId);
    `,
  },
];

export interface GateCheck {
  metric: string;
  operator: '>=' | '<=' | '>' | '<' | '==' | '!=';
  threshold: number;
}

export interface Gate {
  id: number;
  name: string;
  projectName: string | null;
  checks: GateCheck[];
  createdAt: string;
  updatedAt: string;
}

interface GateRow {
  id: number;
  name: string;
  projectName: string | null;
  checks: string;
  createdAt: string;
  updatedAt: string;
}

export interface GateEvaluation {
  id: number;
  gateId: number;
  passed: boolean;
  results: Record<string, unknown>;
  failures: string[];
  evaluatedAt: string;
}

interface GateEvaluationRow {
  id: number;
  gateId: number;
  passed: number;
  results: string;
  failures: string;
  evaluatedAt: string;
}

function rowToGate(row: GateRow): Gate {
  return {
    ...row,
    checks: JSON.parse(row.checks) as GateCheck[],
  };
}

function rowToEvaluation(row: GateEvaluationRow): GateEvaluation {
  return {
    id: row.id,
    gateId: row.gateId,
    passed: row.passed === 1,
    results: JSON.parse(row.results) as Record<string, unknown>,
    failures: JSON.parse(row.failures) as string[],
    evaluatedAt: row.evaluatedAt,
  };
}

export class GateStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'quality-gate',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  defineGate(input: {
    name: string;
    projectName?: string;
    checks: GateCheck[];
  }): Gate {
    const stmt = this.db.prepare(`
      INSERT INTO gates (name, projectName, checks)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      input.name,
      input.projectName ?? null,
      JSON.stringify(input.checks),
    );
    return this.getGate(Number(result.lastInsertRowid))!;
  }

  getGate(id: number): Gate | undefined {
    const row = this.db
      .prepare('SELECT * FROM gates WHERE id = ?')
      .get(id) as GateRow | undefined;
    return row ? rowToGate(row) : undefined;
  }

  getGateByName(name: string): Gate | undefined {
    const row = this.db
      .prepare('SELECT * FROM gates WHERE name = ?')
      .get(name) as GateRow | undefined;
    return row ? rowToGate(row) : undefined;
  }

  listGates(filters?: { projectName?: string }): Gate[] {
    let sql = 'SELECT * FROM gates WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.projectName) {
      sql += ' AND projectName = ?';
      params.push(filters.projectName);
    }

    sql += ' ORDER BY createdAt DESC';

    const rows = this.db.prepare(sql).all(...params) as GateRow[];
    return rows.map(rowToGate);
  }

  deleteGate(id: number): boolean {
    const result = this.db
      .prepare('DELETE FROM gates WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  evaluateGate(gateId: number, metrics: Record<string, number>): GateEvaluation {
    const gate = this.getGate(gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);

    const failures: string[] = [];
    const results: Record<string, { check: GateCheck; actual: number | null; passed: boolean }> = {};

    for (const check of gate.checks) {
      const actual = metrics[check.metric] ?? null;
      let passed = false;
      if (actual !== null) {
        switch (check.operator) {
          case '>=': passed = actual >= check.threshold; break;
          case '<=': passed = actual <= check.threshold; break;
          case '>': passed = actual > check.threshold; break;
          case '<': passed = actual < check.threshold; break;
          case '==': passed = actual === check.threshold; break;
          case '!=': passed = actual !== check.threshold; break;
        }
      }
      results[check.metric] = { check, actual, passed };
      if (!passed) {
        failures.push(`${check.metric}: expected ${check.operator} ${check.threshold}, got ${actual ?? 'missing'}`);
      }
    }

    const allPassed = failures.length === 0;

    const stmt = this.db.prepare(`
      INSERT INTO gate_evaluations (gateId, passed, results, failures)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      gateId,
      allPassed ? 1 : 0,
      JSON.stringify(results),
      JSON.stringify(failures),
    );

    const row = this.db
      .prepare('SELECT * FROM gate_evaluations WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as GateEvaluationRow;
    return rowToEvaluation(row);
  }

  getEvaluationHistory(gateId: number, limit?: number): GateEvaluation[] {
    let sql = 'SELECT * FROM gate_evaluations WHERE gateId = ? ORDER BY evaluatedAt DESC';
    const params: unknown[] = [gateId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as GateEvaluationRow[];
    return rows.map(rowToEvaluation);
  }
}
