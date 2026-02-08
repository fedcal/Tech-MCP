/**
 * SQLite storage layer for the Project Scaffolding MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScaffoldedProject {
  id: number;
  projectName: string;
  templateName: string;
  outputPath: string;
  options: Record<string, unknown>;
  filesGenerated: number;
  createdAt: string;
}

export interface CustomTemplate {
  id: number;
  name: string;
  description: string;
  files: Record<string, unknown>;
  createdAt: string;
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface ScaffoldedProjectRow {
  id: number;
  projectName: string;
  templateName: string;
  outputPath: string;
  options: string;
  filesGenerated: number;
  createdAt: string;
}

interface CustomTemplateRow {
  id: number;
  name: string;
  description: string;
  files: string;
  createdAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create scaffolded_projects and custom_templates tables',
    up: `
      CREATE TABLE IF NOT EXISTS scaffolded_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT NOT NULL,
        templateName TEXT NOT NULL,
        outputPath TEXT NOT NULL,
        options TEXT NOT NULL DEFAULT '{}',
        filesGenerated INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS custom_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        files TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toScaffoldedProject(row: ScaffoldedProjectRow): ScaffoldedProject {
  return {
    ...row,
    options: JSON.parse(row.options) as Record<string, unknown>,
  };
}

function toCustomTemplate(row: CustomTemplateRow): CustomTemplate {
  return {
    ...row,
    files: JSON.parse(row.files) as Record<string, unknown>,
  };
}

// ── ScaffoldingStore ───────────────────────────────────────────────────

export class ScaffoldingStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'project-scaffolding',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Scaffolded Projects ─────────────────────────────────────────────

  logProject(input: {
    projectName: string;
    templateName: string;
    outputPath: string;
    options: Record<string, unknown>;
    filesGenerated: number;
  }): ScaffoldedProject {
    const stmt = this.db.prepare(
      'INSERT INTO scaffolded_projects (projectName, templateName, outputPath, options, filesGenerated) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.projectName,
      input.templateName,
      input.outputPath,
      JSON.stringify(input.options),
      input.filesGenerated,
    );
    const row = this.db
      .prepare('SELECT * FROM scaffolded_projects WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ScaffoldedProjectRow;
    return toScaffoldedProject(row);
  }

  listProjects(): ScaffoldedProject[] {
    const rows = this.db
      .prepare('SELECT * FROM scaffolded_projects ORDER BY createdAt DESC')
      .all() as ScaffoldedProjectRow[];
    return rows.map(toScaffoldedProject);
  }

  // ── Custom Templates ────────────────────────────────────────────────

  saveTemplate(input: {
    name: string;
    description: string;
    files: Record<string, unknown>;
  }): CustomTemplate {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO custom_templates (name, description, files) VALUES (?, ?, ?)',
    );
    stmt.run(input.name, input.description, JSON.stringify(input.files));
    const row = this.db
      .prepare('SELECT * FROM custom_templates WHERE name = ?')
      .get(input.name) as CustomTemplateRow;
    return toCustomTemplate(row);
  }

  getTemplate(name: string): CustomTemplate | undefined {
    const row = this.db
      .prepare('SELECT * FROM custom_templates WHERE name = ?')
      .get(name) as CustomTemplateRow | undefined;
    return row ? toCustomTemplate(row) : undefined;
  }

  listTemplates(): CustomTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM custom_templates ORDER BY createdAt DESC')
      .all() as CustomTemplateRow[];
    return rows.map(toCustomTemplate);
  }
}
