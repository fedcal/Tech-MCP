/**
 * SQLite storage layer for the Performance Profiler MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// -- Types ------------------------------------------------------------------

export interface BundleAnalysisRecord {
  id: number;
  filePath: string;
  totalSize: number;
  result: Record<string, unknown>;
  analyzedAt: string;
}

export interface BottleneckRecord {
  id: number;
  target: string;
  bottlenecks: Record<string, unknown>[];
  createdAt: string;
}

export interface BenchmarkRecord {
  id: number;
  name: string;
  results: Record<string, unknown>;
  createdAt: string;
}

// -- Raw row types (as stored in SQLite) ------------------------------------

interface BundleAnalysisRow {
  id: number;
  filePath: string;
  totalSize: number;
  result: string;
  analyzedAt: string;
}

interface BottleneckRow {
  id: number;
  target: string;
  bottlenecks: string;
  createdAt: string;
}

interface BenchmarkRow {
  id: number;
  name: string;
  results: string;
  createdAt: string;
}

// -- Migrations -------------------------------------------------------------

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create bundle_analyses, bottleneck_reports, and benchmark_results tables',
    up: `
      CREATE TABLE IF NOT EXISTS bundle_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        totalSize INTEGER NOT NULL DEFAULT 0,
        result TEXT NOT NULL DEFAULT '{}',
        analyzedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bottleneck_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target TEXT NOT NULL,
        bottlenecks TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        results TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// -- Helpers ----------------------------------------------------------------

function toBundleAnalysis(row: BundleAnalysisRow): BundleAnalysisRecord {
  return {
    ...row,
    result: JSON.parse(row.result) as Record<string, unknown>,
  };
}

function toBottleneck(row: BottleneckRow): BottleneckRecord {
  return {
    ...row,
    bottlenecks: JSON.parse(row.bottlenecks) as Record<string, unknown>[],
  };
}

function toBenchmark(row: BenchmarkRow): BenchmarkRecord {
  return {
    ...row,
    results: JSON.parse(row.results) as Record<string, unknown>,
  };
}

// -- ProfilerStore ----------------------------------------------------------

export class ProfilerStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'performance-profiler',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // -- Bundle Analyses ------------------------------------------------------

  saveBundleAnalysis(input: {
    filePath: string;
    totalSize: number;
    result: Record<string, unknown>;
  }): BundleAnalysisRecord {
    const stmt = this.db.prepare(
      'INSERT INTO bundle_analyses (filePath, totalSize, result) VALUES (?, ?, ?)',
    );
    const info = stmt.run(input.filePath, input.totalSize, JSON.stringify(input.result));
    return this.getBundleAnalysis(Number(info.lastInsertRowid))!;
  }

  private getBundleAnalysis(id: number): BundleAnalysisRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM bundle_analyses WHERE id = ?')
      .get(id) as BundleAnalysisRow | undefined;
    return row ? toBundleAnalysis(row) : undefined;
  }

  listBundleAnalyses(filePath?: string): BundleAnalysisRecord[] {
    if (filePath) {
      const rows = this.db
        .prepare('SELECT * FROM bundle_analyses WHERE filePath = ? ORDER BY analyzedAt DESC')
        .all(filePath) as BundleAnalysisRow[];
      return rows.map(toBundleAnalysis);
    }
    const rows = this.db
      .prepare('SELECT * FROM bundle_analyses ORDER BY analyzedAt DESC')
      .all() as BundleAnalysisRow[];
    return rows.map(toBundleAnalysis);
  }

  // -- Bottleneck Reports ---------------------------------------------------

  saveBottleneck(input: {
    target: string;
    bottlenecks: Record<string, unknown>[];
  }): BottleneckRecord {
    const stmt = this.db.prepare(
      'INSERT INTO bottleneck_reports (target, bottlenecks) VALUES (?, ?)',
    );
    const info = stmt.run(input.target, JSON.stringify(input.bottlenecks));
    return this.getBottleneck(Number(info.lastInsertRowid))!;
  }

  private getBottleneck(id: number): BottleneckRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM bottleneck_reports WHERE id = ?')
      .get(id) as BottleneckRow | undefined;
    return row ? toBottleneck(row) : undefined;
  }

  // -- Benchmark Results ----------------------------------------------------

  saveBenchmark(input: {
    name: string;
    results: Record<string, unknown>;
  }): BenchmarkRecord {
    const stmt = this.db.prepare(
      'INSERT INTO benchmark_results (name, results) VALUES (?, ?)',
    );
    const info = stmt.run(input.name, JSON.stringify(input.results));
    return this.getBenchmark(Number(info.lastInsertRowid))!;
  }

  private getBenchmark(id: number): BenchmarkRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM benchmark_results WHERE id = ?')
      .get(id) as BenchmarkRow | undefined;
    return row ? toBenchmark(row) : undefined;
  }

  listBenchmarks(name?: string): BenchmarkRecord[] {
    if (name) {
      const rows = this.db
        .prepare('SELECT * FROM benchmark_results WHERE name = ? ORDER BY createdAt DESC')
        .all(name) as BenchmarkRow[];
      return rows.map(toBenchmark);
    }
    const rows = this.db
      .prepare('SELECT * FROM benchmark_results ORDER BY createdAt DESC')
      .all() as BenchmarkRow[];
    return rows.map(toBenchmark);
  }
}
