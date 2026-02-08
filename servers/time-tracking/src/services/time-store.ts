/**
 * SQLite storage service for time tracking.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create time_entries and active_timers tables',
    up: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        userId TEXT DEFAULT 'default',
        startTime TEXT,
        endTime TEXT,
        durationMinutes INTEGER NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS active_timers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        userId TEXT DEFAULT 'default',
        startTime TEXT NOT NULL,
        description TEXT
      );
    `,
  },
  {
    version: 2,
    description: 'Create task_estimates table for estimate vs actual tracking',
    up: `
      CREATE TABLE IF NOT EXISTS task_estimates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        estimateMinutes INTEGER NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_task_estimates_taskId ON task_estimates(taskId);
    `,
  },
];

export interface TimeEntry {
  id: number;
  taskId: string;
  userId: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  description: string | null;
  date: string;
  createdAt: string;
}

export interface ActiveTimer {
  id: number;
  taskId: string;
  userId: string;
  startTime: string;
  description: string | null;
}

export interface TaskEstimate {
  id: number;
  taskId: string;
  estimateMinutes: number;
  description: string | null;
  createdAt: string;
}

export interface AnomalyReport {
  userId: string;
  anomalies: Array<{
    type: string;
    description: string;
    entries: TimeEntry[];
  }>;
  analyzedFrom: string;
  analyzedTo: string;
}

export interface EstimateVsActual {
  taskId: string;
  estimateMinutes: number;
  actualMinutes: number;
  differenceMinutes: number;
  accuracy: number; // percentage, 100 = perfect
}

export class TimeStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'time-tracking',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  startTimer(taskId: string, description?: string, userId?: string): ActiveTimer {
    const existing = this.getActiveTimer(userId);
    if (existing) {
      throw new Error(`An active timer already exists for task "${existing.taskId}". Stop it first.`);
    }

    const startTime = new Date().toISOString();
    const stmt = this.db.prepare(
      'INSERT INTO active_timers (taskId, userId, startTime, description) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(taskId, userId || 'default', startTime, description || null);

    return {
      id: result.lastInsertRowid as number,
      taskId,
      userId: userId || 'default',
      startTime,
      description: description || null,
    };
  }

  stopTimer(userId?: string): TimeEntry {
    const timer = this.getActiveTimer(userId);
    if (!timer) {
      throw new Error('No active timer found.');
    }

    const endTime = new Date().toISOString();
    const startMs = new Date(timer.startTime).getTime();
    const endMs = new Date(endTime).getTime();
    const durationMinutes = Math.round((endMs - startMs) / 60000);
    const date = new Date(timer.startTime).toISOString().split('T')[0];

    const insertStmt = this.db.prepare(
      'INSERT INTO time_entries (taskId, userId, startTime, endTime, durationMinutes, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const result = insertStmt.run(
      timer.taskId,
      timer.userId,
      timer.startTime,
      endTime,
      durationMinutes,
      timer.description,
      date,
    );

    this.db.prepare('DELETE FROM active_timers WHERE id = ?').run(timer.id);

    return {
      id: result.lastInsertRowid as number,
      taskId: timer.taskId,
      userId: timer.userId,
      startTime: timer.startTime,
      endTime,
      durationMinutes,
      description: timer.description,
      date,
      createdAt: new Date().toISOString(),
    };
  }

  logTime(
    taskId: string,
    durationMinutes: number,
    description?: string,
    date?: string,
    userId?: string,
  ): TimeEntry {
    const entryDate = date || new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(
      'INSERT INTO time_entries (taskId, userId, durationMinutes, description, date) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(taskId, userId || 'default', durationMinutes, description || null, entryDate);

    return {
      id: result.lastInsertRowid as number,
      taskId,
      userId: userId || 'default',
      startTime: null,
      endTime: null,
      durationMinutes,
      description: description || null,
      date: entryDate,
      createdAt: new Date().toISOString(),
    };
  }

  getActiveTimer(userId?: string): ActiveTimer | null {
    const uid = userId || 'default';
    const row = this.db
      .prepare('SELECT * FROM active_timers WHERE userId = ? LIMIT 1')
      .get(uid) as ActiveTimer | undefined;
    return row || null;
  }

  getTimesheet(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): { entries: TimeEntry[]; totalMinutes: number } {
    const uid = userId || 'default';
    let sql = 'SELECT * FROM time_entries WHERE userId = ?';
    const params: Array<string> = [uid];

    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY date DESC, createdAt DESC';

    const entries = this.db.prepare(sql).all(...params) as TimeEntry[];
    const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);

    return { entries, totalMinutes };
  }

  getTaskTime(taskId: string): { taskId: string; totalMinutes: number; entries: TimeEntry[] } {
    const entries = this.db
      .prepare('SELECT * FROM time_entries WHERE taskId = ? ORDER BY date DESC, createdAt DESC')
      .all(taskId) as TimeEntry[];
    const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);

    return { taskId, totalMinutes, entries };
  }

  editEntry(
    id: number,
    updates: { taskId?: string; durationMinutes?: number; description?: string; date?: string },
  ): TimeEntry {
    const existing = this.db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as
      | TimeEntry
      | undefined;
    if (!existing) {
      throw new Error(`Time entry with id ${id} not found.`);
    }

    const taskId = updates.taskId ?? existing.taskId;
    const durationMinutes = updates.durationMinutes ?? existing.durationMinutes;
    const description = updates.description ?? existing.description;
    const date = updates.date ?? existing.date;

    this.db
      .prepare(
        'UPDATE time_entries SET taskId = ?, durationMinutes = ?, description = ?, date = ? WHERE id = ?',
      )
      .run(taskId, durationMinutes, description, date, id);

    return {
      ...existing,
      taskId,
      durationMinutes,
      description,
      date,
    };
  }

  deleteEntry(id: number): boolean {
    const result = this.db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new Error(`Time entry with id ${id} not found.`);
    }
    return true;
  }

  saveEstimate(taskId: string, estimateMinutes: number, description?: string): TaskEstimate {
    const stmt = this.db.prepare(
      'INSERT INTO task_estimates (taskId, estimateMinutes, description) VALUES (?, ?, ?)',
    );
    const result = stmt.run(taskId, estimateMinutes, description || null);
    return this.db.prepare('SELECT * FROM task_estimates WHERE id = ?').get(Number(result.lastInsertRowid)) as TaskEstimate;
  }

  getEstimate(taskId: string): TaskEstimate | undefined {
    return this.db
      .prepare('SELECT * FROM task_estimates WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1')
      .get(taskId) as TaskEstimate | undefined;
  }

  getEstimateVsActual(taskId: string): EstimateVsActual | null {
    const estimate = this.getEstimate(taskId);
    if (!estimate) return null;

    const taskTime = this.getTaskTime(taskId);
    const actualMinutes = taskTime.totalMinutes;

    const differenceMinutes = actualMinutes - estimate.estimateMinutes;
    const accuracy = estimate.estimateMinutes > 0
      ? Math.round((1 - Math.abs(differenceMinutes) / estimate.estimateMinutes) * 100)
      : (actualMinutes === 0 ? 100 : 0);

    return {
      taskId,
      estimateMinutes: estimate.estimateMinutes,
      actualMinutes,
      differenceMinutes,
      accuracy: Math.max(0, accuracy),
    };
  }

  detectAnomalies(userId?: string, days: number = 30): AnomalyReport {
    const uid = userId || 'default';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date().toISOString().split('T')[0];

    const entries = this.db
      .prepare('SELECT * FROM time_entries WHERE userId = ? AND date >= ? ORDER BY date ASC')
      .all(uid, startDateStr) as TimeEntry[];

    const anomalies: AnomalyReport['anomalies'] = [];

    // Detect: >10h in a single day
    const byDate: Record<string, TimeEntry[]> = {};
    for (const e of entries) {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    }
    for (const [date, dayEntries] of Object.entries(byDate)) {
      const totalMins = dayEntries.reduce((s, e) => s + e.durationMinutes, 0);
      if (totalMins > 600) {
        anomalies.push({
          type: 'excessive-daily-hours',
          description: `${totalMins} minutes (${(totalMins / 60).toFixed(1)}h) logged on ${date} (>10h threshold)`,
          entries: dayEntries,
        });
      }
    }

    // Detect: weekend work
    for (const [date, dayEntries] of Object.entries(byDate)) {
      const dayOfWeek = new Date(date).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        anomalies.push({
          type: 'weekend-work',
          description: `Work logged on weekend: ${date}`,
          entries: dayEntries,
        });
      }
    }

    // Detect: duplicate entries (same task, same date, same duration)
    for (const dayEntries of Object.values(byDate)) {
      const seen = new Map<string, TimeEntry>();
      for (const e of dayEntries) {
        const key = `${e.taskId}:${e.durationMinutes}`;
        if (seen.has(key)) {
          anomalies.push({
            type: 'potential-duplicate',
            description: `Duplicate entry for task "${e.taskId}" with ${e.durationMinutes}min on ${e.date}`,
            entries: [seen.get(key)!, e],
          });
        } else {
          seen.set(key, e);
        }
      }
    }

    return {
      userId: uid,
      anomalies,
      analyzedFrom: startDateStr,
      analyzedTo: endDateStr,
    };
  }
}
