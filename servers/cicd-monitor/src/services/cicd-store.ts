/**
 * SQLite storage layer for the CI/CD Monitor MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface PipelineRun {
  id: number;
  runId: string;
  repo: string | null;
  branch: string | null;
  status: string;
  conclusion: string | null;
  workflow: string | null;
  createdAt: string;
}

export interface FlakyTest {
  id: number;
  repo: string | null;
  workflow: string;
  job: string;
  step: string;
  flakinessRate: number;
  passCount: number;
  failCount: number;
  detectedAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface PipelineRunRow {
  id: number;
  runId: string;
  repo: string | null;
  branch: string | null;
  status: string;
  conclusion: string | null;
  workflow: string | null;
  createdAt: string;
}

interface FlakyTestRow {
  id: number;
  repo: string | null;
  workflow: string;
  job: string;
  step: string;
  flakinessRate: number;
  passCount: number;
  failCount: number;
  detectedAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create pipeline_runs and flaky_tests tables',
    up: `
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        runId TEXT NOT NULL,
        repo TEXT,
        branch TEXT,
        status TEXT NOT NULL,
        conclusion TEXT,
        workflow TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS flaky_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo TEXT,
        workflow TEXT NOT NULL,
        job TEXT NOT NULL,
        step TEXT NOT NULL,
        flakinessRate REAL NOT NULL,
        passCount INTEGER NOT NULL,
        failCount INTEGER NOT NULL,
        detectedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toPipelineRun(row: PipelineRunRow): PipelineRun {
  return { ...row };
}

function toFlakyTest(row: FlakyTestRow): FlakyTest {
  return { ...row };
}

// ── CicdStore ──────────────────────────────────────────────────────────

export class CicdStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'cicd-monitor',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Pipeline Runs ──────────────────────────────────────────────────

  savePipelineRun(input: {
    runId: string;
    repo?: string;
    branch?: string;
    status: string;
    conclusion?: string;
    workflow?: string;
  }): PipelineRun {
    const stmt = this.db.prepare(
      'INSERT INTO pipeline_runs (runId, repo, branch, status, conclusion, workflow) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.runId,
      input.repo ?? null,
      input.branch ?? null,
      input.status,
      input.conclusion ?? null,
      input.workflow ?? null,
    );
    return this.getPipelineRun(Number(result.lastInsertRowid))!;
  }

  getPipelineRun(id: number): PipelineRun | undefined {
    const row = this.db
      .prepare('SELECT * FROM pipeline_runs WHERE id = ?')
      .get(id) as PipelineRunRow | undefined;
    return row ? toPipelineRun(row) : undefined;
  }

  listPipelineRuns(repo?: string, limit?: number): PipelineRun[] {
    const effectiveLimit = limit ?? 50;
    if (repo) {
      const rows = this.db
        .prepare('SELECT * FROM pipeline_runs WHERE repo = ? ORDER BY createdAt DESC LIMIT ?')
        .all(repo, effectiveLimit) as PipelineRunRow[];
      return rows.map(toPipelineRun);
    }
    const rows = this.db
      .prepare('SELECT * FROM pipeline_runs ORDER BY createdAt DESC LIMIT ?')
      .all(effectiveLimit) as PipelineRunRow[];
    return rows.map(toPipelineRun);
  }

  // ── Flaky Tests ────────────────────────────────────────────────────

  saveFlakyTest(input: {
    repo?: string;
    workflow: string;
    job: string;
    step: string;
    flakinessRate: number;
    passCount: number;
    failCount: number;
  }): FlakyTest {
    const stmt = this.db.prepare(
      'INSERT INTO flaky_tests (repo, workflow, job, step, flakinessRate, passCount, failCount) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.repo ?? null,
      input.workflow,
      input.job,
      input.step,
      input.flakinessRate,
      input.passCount,
      input.failCount,
    );
    return this.getFlakyTest(Number(result.lastInsertRowid))!;
  }

  getFlakyTest(id: number): FlakyTest | undefined {
    const row = this.db
      .prepare('SELECT * FROM flaky_tests WHERE id = ?')
      .get(id) as FlakyTestRow | undefined;
    return row ? toFlakyTest(row) : undefined;
  }

  listFlakyTests(repo?: string): FlakyTest[] {
    if (repo) {
      const rows = this.db
        .prepare('SELECT * FROM flaky_tests WHERE repo = ? ORDER BY flakinessRate DESC, detectedAt DESC')
        .all(repo) as FlakyTestRow[];
      return rows.map(toFlakyTest);
    }
    const rows = this.db
      .prepare('SELECT * FROM flaky_tests ORDER BY flakinessRate DESC, detectedAt DESC')
      .all() as FlakyTestRow[];
    return rows.map(toFlakyTest);
  }
}
