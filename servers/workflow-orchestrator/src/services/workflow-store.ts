/**
 * SQLite store for workflow definitions, runs, and steps.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create workflows, workflow_runs, and workflow_steps tables',
    up: `
      CREATE TABLE workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        triggerEvent TEXT NOT NULL,
        triggerConditions TEXT NOT NULL DEFAULT '{}',
        steps TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_workflows_active ON workflows(active);
      CREATE INDEX idx_workflows_trigger ON workflows(triggerEvent);

      CREATE TABLE workflow_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflowId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        triggerPayload TEXT NOT NULL DEFAULT '{}',
        error TEXT,
        startedAt TEXT NOT NULL DEFAULT (datetime('now')),
        completedAt TEXT,
        durationMs INTEGER,
        FOREIGN KEY (workflowId) REFERENCES workflows(id)
      );
      CREATE INDEX idx_runs_workflow ON workflow_runs(workflowId);
      CREATE INDEX idx_runs_status ON workflow_runs(status);

      CREATE TABLE workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        runId INTEGER NOT NULL,
        stepIndex INTEGER NOT NULL,
        server TEXT NOT NULL,
        tool TEXT NOT NULL,
        arguments TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error TEXT,
        startedAt TEXT,
        completedAt TEXT,
        FOREIGN KEY (runId) REFERENCES workflow_runs(id)
      );
      CREATE INDEX idx_steps_run ON workflow_steps(runId);
    `,
  },
];

export interface Workflow {
  id: number;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerConditions: Record<string, unknown>;
  steps: { server: string; tool: string; arguments: Record<string, unknown> }[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunRecord {
  id: number;
  workflowId: number;
  status: string;
  triggerPayload: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface WorkflowStepRecord {
  id: number;
  runId: number;
  stepIndex: number;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface WorkflowRow {
  id: number;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerConditions: string;
  steps: string;
  active: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowRunRow {
  id: number;
  workflowId: number;
  status: string;
  triggerPayload: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

interface WorkflowStepRow {
  id: number;
  runId: number;
  stepIndex: number;
  server: string;
  tool: string;
  arguments: string;
  status: string;
  result: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    ...row,
    triggerConditions: JSON.parse(row.triggerConditions) as Record<string, unknown>,
    steps: JSON.parse(row.steps) as { server: string; tool: string; arguments: Record<string, unknown> }[],
    active: row.active === 1,
  };
}

function rowToRun(row: WorkflowRunRow): WorkflowRunRecord {
  return {
    ...row,
    triggerPayload: JSON.parse(row.triggerPayload) as Record<string, unknown>,
  };
}

function rowToStep(row: WorkflowStepRow): WorkflowStepRecord {
  return {
    ...row,
    arguments: JSON.parse(row.arguments) as Record<string, unknown>,
    result: row.result ? (JSON.parse(row.result) as Record<string, unknown>) : null,
  };
}

export class WorkflowStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'workflow-orchestrator',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  createWorkflow(input: {
    name: string;
    description?: string;
    triggerEvent: string;
    triggerConditions?: Record<string, unknown>;
    steps: { server: string; tool: string; arguments: Record<string, unknown> }[];
  }): Workflow {
    const stmt = this.db.prepare(`
      INSERT INTO workflows (name, description, triggerEvent, triggerConditions, steps)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.name,
      input.description ?? null,
      input.triggerEvent,
      JSON.stringify(input.triggerConditions ?? {}),
      JSON.stringify(input.steps),
    );
    return this.getWorkflow(Number(result.lastInsertRowid))!;
  }

  getWorkflow(id: number): Workflow | undefined {
    const row = this.db
      .prepare('SELECT * FROM workflows WHERE id = ?')
      .get(id) as WorkflowRow | undefined;
    return row ? rowToWorkflow(row) : undefined;
  }

  listWorkflows(filters?: { active?: boolean }): Workflow[] {
    let sql = 'SELECT * FROM workflows WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.active !== undefined) {
      sql += ' AND active = ?';
      params.push(filters.active ? 1 : 0);
    }

    sql += ' ORDER BY createdAt DESC';

    const rows = this.db.prepare(sql).all(...params) as WorkflowRow[];
    return rows.map(rowToWorkflow);
  }

  toggleWorkflow(id: number, active: boolean): Workflow | undefined {
    this.db
      .prepare('UPDATE workflows SET active = ?, updatedAt = datetime(\'now\') WHERE id = ?')
      .run(active ? 1 : 0, id);
    return this.getWorkflow(id);
  }

  getActiveWorkflowsByTrigger(eventName: string): Workflow[] {
    const rows = this.db
      .prepare('SELECT * FROM workflows WHERE triggerEvent = ? AND active = 1')
      .all(eventName) as WorkflowRow[];
    return rows.map(rowToWorkflow);
  }

  createRun(workflowId: number, triggerPayload: Record<string, unknown>): WorkflowRunRecord {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_runs (workflowId, triggerPayload)
      VALUES (?, ?)
    `);
    const result = stmt.run(workflowId, JSON.stringify(triggerPayload));
    return this.getRun(Number(result.lastInsertRowid))!;
  }

  updateRun(runId: number, updates: {
    status?: string;
    error?: string;
    completedAt?: string;
    durationMs?: number;
  }): void {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      params.push(updates.error);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completedAt = ?');
      params.push(updates.completedAt);
    }
    if (updates.durationMs !== undefined) {
      fields.push('durationMs = ?');
      params.push(updates.durationMs);
    }

    if (fields.length === 0) return;

    params.push(runId);
    this.db.prepare(`UPDATE workflow_runs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  getRun(runId: number): WorkflowRunRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM workflow_runs WHERE id = ?')
      .get(runId) as WorkflowRunRow | undefined;
    return row ? rowToRun(row) : undefined;
  }

  getRunsForWorkflow(workflowId: number, limit?: number): WorkflowRunRecord[] {
    let sql = 'SELECT * FROM workflow_runs WHERE workflowId = ? ORDER BY startedAt DESC';
    const params: unknown[] = [workflowId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as WorkflowRunRow[];
    return rows.map(rowToRun);
  }

  createStep(
    runId: number,
    stepIndex: number,
    server: string,
    tool: string,
    args: Record<string, unknown>,
  ): WorkflowStepRecord {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_steps (runId, stepIndex, server, tool, arguments)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(runId, stepIndex, server, tool, JSON.stringify(args));
    const row = this.db
      .prepare('SELECT * FROM workflow_steps WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as WorkflowStepRow;
    return rowToStep(row);
  }

  updateStep(stepId: number, updates: {
    status?: string;
    result?: Record<string, unknown>;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }): void {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.result !== undefined) {
      fields.push('result = ?');
      params.push(JSON.stringify(updates.result));
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      params.push(updates.error);
    }
    if (updates.startedAt !== undefined) {
      fields.push('startedAt = ?');
      params.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completedAt = ?');
      params.push(updates.completedAt);
    }

    if (fields.length === 0) return;

    params.push(stepId);
    this.db.prepare(`UPDATE workflow_steps SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  getStepsForRun(runId: number): WorkflowStepRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_steps WHERE runId = ? ORDER BY stepIndex')
      .all(runId) as WorkflowStepRow[];
    return rows.map(rowToStep);
  }
}
