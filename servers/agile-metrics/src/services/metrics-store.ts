/**
 * SQLite storage layer for the Agile Metrics MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface VelocityRecord {
  id: number;
  sprintName: string;
  completedPoints: number;
  totalPoints: number;
  completionRate: number;
  recordedAt: string;
}

export interface MetricSnapshot {
  id: number;
  metricType: string;
  result: string;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface VelocityRow {
  id: number;
  sprintName: string;
  completedPoints: number;
  totalPoints: number;
  completionRate: number;
  recordedAt: string;
}

interface SnapshotRow {
  id: number;
  metricType: string;
  result: string;
  createdAt: string;
}

// -- Predictive Analytics Types --

export interface RiskPrediction {
  id: number;
  sprintId: string;
  riskLevel: string;
  riskScore: number;
  factors: string[];
  recommendation: string;
  createdAt: string;
}

interface RiskPredictionRow {
  id: number;
  sprintId: string;
  riskLevel: string;
  riskScore: number;
  factors: string;
  recommendation: string;
  createdAt: string;
}

export interface FactorCorrelation {
  id: number;
  factorA: string;
  factorB: string;
  correlation: number;
  sampleSize: number;
  description: string | null;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create velocity_records and metric_snapshots tables',
    up: `
      CREATE TABLE IF NOT EXISTS velocity_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sprintName TEXT NOT NULL,
        completedPoints REAL NOT NULL,
        totalPoints REAL NOT NULL,
        completionRate REAL NOT NULL,
        recordedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metricType TEXT NOT NULL,
        result TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    description: 'Create risk_predictions and factor_correlations tables',
    up: `
      CREATE TABLE IF NOT EXISTS risk_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sprintId TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        riskScore REAL NOT NULL,
        factors TEXT NOT NULL DEFAULT '[]',
        recommendation TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS factor_correlations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factorA TEXT NOT NULL,
        factorB TEXT NOT NULL,
        correlation REAL NOT NULL,
        sampleSize INTEGER NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_risk_predictions_sprint ON risk_predictions(sprintId);
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toVelocityRecord(row: VelocityRow): VelocityRecord {
  return { ...row };
}

function toSnapshot(row: SnapshotRow): MetricSnapshot {
  return { ...row };
}

// ── MetricsStore ──────────────────────────────────────────────────────

export class MetricsStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'agile-metrics',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // ── Velocity Records ──────────────────────────────────────────────

  saveVelocity(input: {
    sprintName: string;
    completedPoints: number;
    totalPoints: number;
    completionRate: number;
  }): VelocityRecord {
    const stmt = this.db.prepare(
      'INSERT INTO velocity_records (sprintName, completedPoints, totalPoints, completionRate) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.sprintName,
      input.completedPoints,
      input.totalPoints,
      input.completionRate,
    );
    const row = this.db
      .prepare('SELECT * FROM velocity_records WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as VelocityRow;
    return toVelocityRecord(row);
  }

  getVelocityHistory(limit?: number): VelocityRecord[] {
    const sql = limit
      ? 'SELECT * FROM velocity_records ORDER BY recordedAt DESC LIMIT ?'
      : 'SELECT * FROM velocity_records ORDER BY recordedAt DESC';
    const rows = (limit
      ? this.db.prepare(sql).all(limit)
      : this.db.prepare(sql).all()) as VelocityRow[];
    return rows.map(toVelocityRecord);
  }

  // ── Metric Snapshots ──────────────────────────────────────────────

  saveSnapshot(metricType: string, result: string): MetricSnapshot {
    const stmt = this.db.prepare(
      'INSERT INTO metric_snapshots (metricType, result) VALUES (?, ?)',
    );
    const res = stmt.run(metricType, result);
    const row = this.db
      .prepare('SELECT * FROM metric_snapshots WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as SnapshotRow;
    return toSnapshot(row);
  }

  listSnapshots(metricType?: string): MetricSnapshot[] {
    if (metricType) {
      const rows = this.db
        .prepare(
          'SELECT * FROM metric_snapshots WHERE metricType = ? ORDER BY createdAt DESC',
        )
        .all(metricType) as SnapshotRow[];
      return rows.map(toSnapshot);
    }
    const rows = this.db
      .prepare('SELECT * FROM metric_snapshots ORDER BY createdAt DESC')
      .all() as SnapshotRow[];
    return rows.map(toSnapshot);
  }

  // -- Risk Predictions --

  saveRiskPrediction(input: {
    sprintId: string;
    riskLevel: string;
    riskScore: number;
    factors: string[];
    recommendation: string;
  }): RiskPrediction {
    const stmt = this.db.prepare(
      'INSERT INTO risk_predictions (sprintId, riskLevel, riskScore, factors, recommendation) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.sprintId,
      input.riskLevel,
      input.riskScore,
      JSON.stringify(input.factors),
      input.recommendation,
    );
    const row = this.db.prepare('SELECT * FROM risk_predictions WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as RiskPredictionRow;
    return { ...row, factors: JSON.parse(row.factors) as string[] };
  }

  getRiskHistory(sprintId?: string, limit: number = 10): RiskPrediction[] {
    let sql: string;
    let rows: RiskPredictionRow[];
    if (sprintId) {
      sql = 'SELECT * FROM risk_predictions WHERE sprintId = ? ORDER BY createdAt DESC LIMIT ?';
      rows = this.db.prepare(sql).all(sprintId, limit) as RiskPredictionRow[];
    } else {
      sql = 'SELECT * FROM risk_predictions ORDER BY createdAt DESC LIMIT ?';
      rows = this.db.prepare(sql).all(limit) as RiskPredictionRow[];
    }
    return rows.map(r => ({ ...r, factors: JSON.parse(r.factors) as string[] }));
  }

  // -- Factor Correlations --

  saveCorrelation(input: {
    factorA: string;
    factorB: string;
    correlation: number;
    sampleSize: number;
    description?: string;
  }): FactorCorrelation {
    const stmt = this.db.prepare(
      'INSERT INTO factor_correlations (factorA, factorB, correlation, sampleSize, description) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.factorA,
      input.factorB,
      input.correlation,
      input.sampleSize,
      input.description ?? null,
    );
    return this.db.prepare('SELECT * FROM factor_correlations WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as FactorCorrelation;
  }

  listCorrelations(): FactorCorrelation[] {
    return this.db
      .prepare('SELECT * FROM factor_correlations ORDER BY ABS(correlation) DESC')
      .all() as FactorCorrelation[];
  }

  predictRisk(sprintId: string): RiskPrediction {
    const velocityHistory = this.getVelocityHistory(6);
    const factors: string[] = [];
    let riskScore = 0;

    if (velocityHistory.length < 2) {
      factors.push('insufficient-history');
      riskScore += 30;
    } else {
      // Check velocity trend
      const recentAvg = velocityHistory.slice(0, 3).reduce((s, v) => s + v.completionRate, 0) / Math.min(3, velocityHistory.length);
      const olderAvg = velocityHistory.slice(3).reduce((s, v) => s + v.completionRate, 0) / Math.max(1, velocityHistory.slice(3).length);
      
      if (recentAvg < olderAvg * 0.8) {
        factors.push('declining-velocity');
        riskScore += 25;
      }

      // Check completion rate
      const latestRate = velocityHistory[0]?.completionRate ?? 100;
      if (latestRate < 70) {
        factors.push('low-completion-rate');
        riskScore += 20;
      }

      // Check volatility
      if (velocityHistory.length >= 3) {
        const rates = velocityHistory.map(v => v.completionRate);
        const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
        const variance = rates.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / rates.length;
        const stddev = Math.sqrt(variance);
        if (stddev > 20) {
          factors.push('high-volatility');
          riskScore += 15;
        }
      }
    }

    if (factors.length === 0) {
      factors.push('healthy-metrics');
    }

    riskScore = Math.min(100, Math.max(0, riskScore));
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';
    const recommendation = riskLevel === 'high'
      ? 'Consider reducing sprint scope or addressing team bottlenecks'
      : riskLevel === 'medium'
        ? 'Monitor velocity trends closely this sprint'
        : 'Sprint outlook is healthy based on historical data';

    return this.saveRiskPrediction({ sprintId, riskLevel, riskScore, factors, recommendation });
  }
}
