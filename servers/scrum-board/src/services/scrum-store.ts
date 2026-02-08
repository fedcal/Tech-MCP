/**
 * SQLite storage layer for the Scrum Board MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  goals: string[];
  status: string;
  createdAt: string;
}

export interface Story {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: string;
  status: string;
  sprintId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  assignee: string | null;
  storyId: number;
  sprintId: number | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

export interface SprintBoard {
  sprint: Sprint;
  columns: {
    todo: Task[];
    in_progress: Task[];
    in_review: Task[];
    done: Task[];
    blocked: Task[];
  };
}

// ── Raw row types (as stored in SQLite) ────────────────────────────────

interface SprintRow {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  goals: string;
  status: string;
  createdAt: string;
}

interface StoryRow {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number;
  priority: string;
  status: string;
  sprintId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: string;
  assignee: string | null;
  storyId: number;
  sprintId: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Migrations ─────────────────────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create sprints, stories, and tasks tables',
    up: `
      CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'planning',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        acceptanceCriteria TEXT NOT NULL DEFAULT '[]',
        storyPoints INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo',
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        assignee TEXT,
        storyId INTEGER NOT NULL REFERENCES stories(id),
        sprintId INTEGER REFERENCES sprints(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function toSprint(row: SprintRow): Sprint {
  return {
    ...row,
    goals: JSON.parse(row.goals) as string[],
  };
}

function toStory(row: StoryRow): Story {
  return {
    ...row,
    acceptanceCriteria: JSON.parse(row.acceptanceCriteria) as string[],
  };
}

function toTask(row: TaskRow): Task {
  return { ...row };
}

// ── ScrumStore ─────────────────────────────────────────────────────────

export class ScrumStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'scrum-board',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  // ── Sprints ────────────────────────────────────────────────────────

  createSprint(input: {
    name: string;
    startDate: string;
    endDate: string;
    goals: string[];
  }): Sprint {
    const stmt = this.db.prepare(
      'INSERT INTO sprints (name, startDate, endDate, goals) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(input.name, input.startDate, input.endDate, JSON.stringify(input.goals));
    return this.getSprint(Number(result.lastInsertRowid))!;
  }

  getSprint(id: number): Sprint | undefined {
    const row = this.db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as
      | SprintRow
      | undefined;
    return row ? toSprint(row) : undefined;
  }

  listSprints(): Sprint[] {
    const rows = this.db.prepare('SELECT * FROM sprints ORDER BY createdAt DESC').all() as SprintRow[];
    return rows.map(toSprint);
  }

  closeSprint(id: number): Sprint | undefined {
    this.db
      .prepare("UPDATE sprints SET status = 'completed' WHERE id = ?")
      .run(id);
    return this.getSprint(id);
  }

  // ── Stories ────────────────────────────────────────────────────────

  createStory(input: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    storyPoints: number;
    priority: string;
    sprintId?: number;
  }): Story {
    const stmt = this.db.prepare(
      'INSERT INTO stories (title, description, acceptanceCriteria, storyPoints, priority, sprintId) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.title,
      input.description,
      JSON.stringify(input.acceptanceCriteria),
      input.storyPoints,
      input.priority,
      input.sprintId ?? null,
    );
    return this.getStory(Number(result.lastInsertRowid))!;
  }

  getStory(id: number): Story | undefined {
    const row = this.db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as
      | StoryRow
      | undefined;
    return row ? toStory(row) : undefined;
  }

  getBacklog(): Story[] {
    const rows = this.db
      .prepare('SELECT * FROM stories WHERE sprintId IS NULL ORDER BY priority, createdAt')
      .all() as StoryRow[];
    return rows.map(toStory);
  }

  // ── Tasks ──────────────────────────────────────────────────────────

  createTask(input: {
    title: string;
    description: string;
    storyId: number;
    assignee?: string;
  }): Task {
    // Derive sprintId from the parent story
    const story = this.getStory(input.storyId);
    const sprintId = story?.sprintId ?? null;

    const stmt = this.db.prepare(
      'INSERT INTO tasks (title, description, storyId, sprintId, assignee) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.title,
      input.description,
      input.storyId,
      sprintId,
      input.assignee ?? null,
    );
    return this.getTask(Number(result.lastInsertRowid))!;
  }

  getTask(id: number): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | TaskRow
      | undefined;
    return row ? toTask(row) : undefined;
  }

  updateTaskStatus(taskId: number, status: TaskStatus): Task | undefined {
    this.db
      .prepare("UPDATE tasks SET status = ?, updatedAt = datetime('now') WHERE id = ?")
      .run(status, taskId);
    return this.getTask(taskId);
  }

  // ── Board View ─────────────────────────────────────────────────────

  getSprintBoard(sprintId?: number): SprintBoard | undefined {
    let sprint: Sprint | undefined;

    if (sprintId != null) {
      sprint = this.getSprint(sprintId);
    } else {
      // Default to the active sprint
      const row = this.db
        .prepare("SELECT * FROM sprints WHERE status = 'active' ORDER BY createdAt DESC LIMIT 1")
        .get() as SprintRow | undefined;
      sprint = row ? toSprint(row) : undefined;
    }

    if (!sprint) return undefined;

    const tasks = this.db
      .prepare('SELECT * FROM tasks WHERE sprintId = ?')
      .all(sprint.id) as TaskRow[];

    const columns: SprintBoard['columns'] = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    };

    for (const row of tasks) {
      const task = toTask(row);
      const col = task.status as TaskStatus;
      if (col in columns) {
        columns[col].push(task);
      } else {
        columns.todo.push(task);
      }
    }

    return { sprint, columns };
  }
}
