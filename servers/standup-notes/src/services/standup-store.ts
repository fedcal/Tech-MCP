/**
 * SQLite storage for standup notes.
 * Manages daily standup entries.
 */

import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';
import type Database from 'better-sqlite3';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create standups table',
    up: `
      CREATE TABLE IF NOT EXISTS standups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL DEFAULT 'default',
        date TEXT NOT NULL,
        yesterday TEXT NOT NULL,
        today TEXT NOT NULL,
        blockers TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

export interface Standup {
  id: number;
  userId: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  createdAt: string;
}

export interface StatusReport {
  period: { from: string; to: string; days: number };
  totalStandups: number;
  accomplishments: string[];
  currentWork: string[];
  blockers: string[];
  report: string;
}

export class StandupStore {
  private db: Database.Database;

  constructor(inMemory = false) {
    this.db = createDatabase({ serverName: 'standup-notes', inMemory });
    runMigrations(this.db, migrations);
  }

  logStandup(yesterday: string, today: string, blockers?: string): Standup {
    const date = new Date().toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      INSERT INTO standups (userId, date, yesterday, today, blockers)
      VALUES ('default', ?, ?, ?, ?)
    `);
    const result = stmt.run(date, yesterday, today, blockers || null);

    return this.db.prepare('SELECT * FROM standups WHERE id = ?').get(result.lastInsertRowid) as Standup;
  }

  getStandupHistory(days: number = 7): Standup[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    return this.db
      .prepare('SELECT * FROM standups WHERE date >= ? ORDER BY date DESC, createdAt DESC')
      .all(cutoff) as Standup[];
  }

  generateStatusReport(days: number = 7): StatusReport {
    const standups = this.getStandupHistory(days);

    const accomplishments: string[] = [];
    const currentWork: string[] = [];
    const blockers: string[] = [];

    for (const standup of standups) {
      if (standup.yesterday) {
        accomplishments.push(`[${standup.date}] ${standup.yesterday}`);
      }
      if (standup.today) {
        currentWork.push(`[${standup.date}] ${standup.today}`);
      }
      if (standup.blockers) {
        blockers.push(`[${standup.date}] ${standup.blockers}`);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const from = fromDate.toISOString().split('T')[0];

    const reportLines: string[] = [
      `=== Status Report ===`,
      `Period: ${from} to ${today} (${days} days)`,
      `Total standups: ${standups.length}`,
      ``,
      `--- Accomplishments ---`,
      ...accomplishments.map((a) => `  - ${a}`),
      ``,
      `--- Current Work ---`,
      ...currentWork.map((w) => `  - ${w}`),
      ``,
      `--- Blockers ---`,
      ...(blockers.length > 0 ? blockers.map((b) => `  - ${b}`) : ['  None reported']),
    ];

    return {
      period: { from, to: today, days },
      totalStandups: standups.length,
      accomplishments,
      currentWork,
      blockers,
      report: reportLines.join('\n'),
    };
  }
}
