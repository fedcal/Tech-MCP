/**
 * SQLite storage layer for the Log Analyzer MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface AnalysisResult {
  id: number;
  filePath: string;
  totalLines: number;
  levels: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  analyzedAt: string;
}

export interface ErrorPatternRecord {
  id: number;
  filePath: string;
  patterns: Array<{ pattern: string; count: number; examples: string[] }>;
  detectedAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface AnalysisResultRow {
  id: number;
  filePath: string;
  totalLines: number;
  levels: string;
  topErrors: string;
  analyzedAt: string;
}

interface ErrorPatternRow {
  id: number;
  filePath: string;
  patterns: string;
  detectedAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create analysis_results and error_patterns tables',
    up: `
      CREATE TABLE IF NOT EXISTS analysis_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        totalLines INTEGER NOT NULL,
        levels TEXT NOT NULL DEFAULT '{}',
        topErrors TEXT NOT NULL DEFAULT '[]',
        analyzedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS error_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        patterns TEXT NOT NULL DEFAULT '[]',
        detectedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toAnalysisResult(row: AnalysisResultRow): AnalysisResult {
  return {
    ...row,
    levels: JSON.parse(row.levels) as Record<string, number>,
    topErrors: JSON.parse(row.topErrors) as Array<{ message: string; count: number }>,
  };
}

function toErrorPatternRecord(row: ErrorPatternRow): ErrorPatternRecord {
  return {
    ...row,
    patterns: JSON.parse(row.patterns) as Array<{ pattern: string; count: number; examples: string[] }>,
  };
}

// ── LogStore ───────────────────────────────────────────────────────────

export class LogStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'log-analyzer',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Analysis Results ──────────────────────────────────────────────

  saveAnalysis(input: {
    filePath: string;
    totalLines: number;
    levels: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
  }): AnalysisResult {
    const stmt = this.db.prepare(
      'INSERT INTO analysis_results (filePath, totalLines, levels, topErrors) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.filePath,
      input.totalLines,
      JSON.stringify(input.levels),
      JSON.stringify(input.topErrors),
    );
    return this.getAnalysis(Number(result.lastInsertRowid))!;
  }

  private getAnalysis(id: number): AnalysisResult | undefined {
    const row = this.db.prepare('SELECT * FROM analysis_results WHERE id = ?').get(id) as
      | AnalysisResultRow
      | undefined;
    return row ? toAnalysisResult(row) : undefined;
  }

  getLatestAnalysis(filePath: string): AnalysisResult | undefined {
    const row = this.db
      .prepare('SELECT * FROM analysis_results WHERE filePath = ? ORDER BY analyzedAt DESC LIMIT 1')
      .get(filePath) as AnalysisResultRow | undefined;
    return row ? toAnalysisResult(row) : undefined;
  }

  listAnalyses(): AnalysisResult[] {
    const rows = this.db
      .prepare('SELECT * FROM analysis_results ORDER BY analyzedAt DESC')
      .all() as AnalysisResultRow[];
    return rows.map(toAnalysisResult);
  }

  // ── Error Patterns ────────────────────────────────────────────────

  saveErrorPatterns(input: {
    filePath: string;
    patterns: Array<{ pattern: string; count: number; examples: string[] }>;
  }): ErrorPatternRecord {
    const stmt = this.db.prepare(
      'INSERT INTO error_patterns (filePath, patterns) VALUES (?, ?)',
    );
    const result = stmt.run(input.filePath, JSON.stringify(input.patterns));
    return this.getErrorPattern(Number(result.lastInsertRowid))!;
  }

  private getErrorPattern(id: number): ErrorPatternRecord | undefined {
    const row = this.db.prepare('SELECT * FROM error_patterns WHERE id = ?').get(id) as
      | ErrorPatternRow
      | undefined;
    return row ? toErrorPatternRecord(row) : undefined;
  }

  listErrorPatterns(filePath?: string): ErrorPatternRecord[] {
    if (filePath) {
      const rows = this.db
        .prepare('SELECT * FROM error_patterns WHERE filePath = ? ORDER BY detectedAt DESC')
        .all(filePath) as ErrorPatternRow[];
      return rows.map(toErrorPatternRecord);
    }

    const rows = this.db
      .prepare('SELECT * FROM error_patterns ORDER BY detectedAt DESC')
      .all() as ErrorPatternRow[];
    return rows.map(toErrorPatternRecord);
  }
}
