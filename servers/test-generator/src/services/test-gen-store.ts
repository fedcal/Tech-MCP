/**
 * SQLite storage layer for the Test Generator MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// -- Types ------------------------------------------------------------------

export interface GeneratedTest {
  id: number;
  sourceFilePath: string;
  framework: string;
  testCount: number;
  generatedCode: string;
  createdAt: string;
}

export interface CoverageReport {
  id: number;
  filePath: string;
  coverage: number;
  uncoveredLines: number[];
  createdAt: string;
}

// -- Raw row types (as stored in SQLite) ------------------------------------

interface GeneratedTestRow {
  id: number;
  sourceFilePath: string;
  framework: string;
  testCount: number;
  generatedCode: string;
  createdAt: string;
}

interface CoverageReportRow {
  id: number;
  filePath: string;
  coverage: number;
  uncoveredLines: string;
  createdAt: string;
}

// -- Migrations -------------------------------------------------------------

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create generated_tests and coverage_reports tables',
    up: `
      CREATE TABLE IF NOT EXISTS generated_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceFilePath TEXT NOT NULL,
        framework TEXT NOT NULL,
        testCount INTEGER NOT NULL DEFAULT 0,
        generatedCode TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS coverage_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL,
        coverage REAL NOT NULL DEFAULT 0,
        uncoveredLines TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// -- Helpers ----------------------------------------------------------------

function toGeneratedTest(row: GeneratedTestRow): GeneratedTest {
  return { ...row };
}

function toCoverageReport(row: CoverageReportRow): CoverageReport {
  return {
    ...row,
    uncoveredLines: JSON.parse(row.uncoveredLines) as number[],
  };
}

// -- TestGenStore -----------------------------------------------------------

export class TestGenStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'test-generator',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // -- Generated Tests ------------------------------------------------------

  saveGeneratedTest(input: {
    sourceFilePath: string;
    framework: string;
    testCount: number;
    generatedCode: string;
  }): GeneratedTest {
    const stmt = this.db.prepare(
      'INSERT INTO generated_tests (sourceFilePath, framework, testCount, generatedCode) VALUES (?, ?, ?, ?)',
    );
    const res = stmt.run(
      input.sourceFilePath,
      input.framework,
      input.testCount,
      input.generatedCode,
    );
    return this.getGeneratedTest(Number(res.lastInsertRowid))!;
  }

  private getGeneratedTest(id: number): GeneratedTest | undefined {
    const row = this.db.prepare('SELECT * FROM generated_tests WHERE id = ?').get(id) as
      | GeneratedTestRow
      | undefined;
    return row ? toGeneratedTest(row) : undefined;
  }

  listGeneratedTests(sourceFilePath?: string): GeneratedTest[] {
    let rows: GeneratedTestRow[];
    if (sourceFilePath) {
      rows = this.db
        .prepare('SELECT * FROM generated_tests WHERE sourceFilePath = ? ORDER BY createdAt DESC')
        .all(sourceFilePath) as GeneratedTestRow[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM generated_tests ORDER BY createdAt DESC')
        .all() as GeneratedTestRow[];
    }
    return rows.map(toGeneratedTest);
  }

  // -- Coverage Reports -----------------------------------------------------

  saveCoverage(input: {
    filePath: string;
    coverage: number;
    uncoveredLines: number[];
  }): CoverageReport {
    const stmt = this.db.prepare(
      'INSERT INTO coverage_reports (filePath, coverage, uncoveredLines) VALUES (?, ?, ?)',
    );
    const res = stmt.run(
      input.filePath,
      input.coverage,
      JSON.stringify(input.uncoveredLines),
    );
    return this.getCoverageReport(Number(res.lastInsertRowid))!;
  }

  private getCoverageReport(id: number): CoverageReport | undefined {
    const row = this.db.prepare('SELECT * FROM coverage_reports WHERE id = ?').get(id) as
      | CoverageReportRow
      | undefined;
    return row ? toCoverageReport(row) : undefined;
  }

  listCoverageReports(): CoverageReport[] {
    const rows = this.db
      .prepare('SELECT * FROM coverage_reports ORDER BY createdAt DESC')
      .all() as CoverageReportRow[];
    return rows.map(toCoverageReport);
  }
}
