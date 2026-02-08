/**
 * SQLite storage layer for the Code Review MCP server.
 */

import type Database from 'better-sqlite3';
import { createDatabase } from '@mcp-suite/database';
import { runMigrations, type Migration } from '@mcp-suite/database';

// -- Types ------------------------------------------------------------------

export interface Review {
  id: number;
  reviewType: string;
  filePath: string | null;
  issuesFound: number;
  suggestions: string[];
  result: string;
  createdAt: string;
}

export interface ComplexityRecord {
  id: number;
  filePath: string | null;
  language: string;
  totalComplexity: number;
  rating: string;
  lineCount: number;
  createdAt: string;
}

// -- Raw row types (as stored in SQLite) ------------------------------------

interface ReviewRow {
  id: number;
  reviewType: string;
  filePath: string | null;
  issuesFound: number;
  suggestions: string;
  result: string;
  createdAt: string;
}

interface ComplexityRecordRow {
  id: number;
  filePath: string | null;
  language: string;
  totalComplexity: number;
  rating: string;
  lineCount: number;
  createdAt: string;
}

// -- Migrations -------------------------------------------------------------

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create reviews and complexity_records tables',
    up: `
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reviewType TEXT NOT NULL,
        filePath TEXT,
        issuesFound INTEGER NOT NULL DEFAULT 0,
        suggestions TEXT NOT NULL DEFAULT '[]',
        result TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS complexity_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT,
        language TEXT NOT NULL,
        totalComplexity INTEGER NOT NULL,
        rating TEXT NOT NULL,
        lineCount INTEGER NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// -- Helpers ----------------------------------------------------------------

function toReview(row: ReviewRow): Review {
  return {
    ...row,
    suggestions: JSON.parse(row.suggestions) as string[],
  };
}

function toComplexityRecord(row: ComplexityRecordRow): ComplexityRecord {
  return { ...row };
}

// -- ReviewStore ------------------------------------------------------------

export class ReviewStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean }) {
    this.db = createDatabase({
      serverName: 'code-review',
      inMemory: options?.inMemory,
    });
    runMigrations(this.db, migrations);
  }

  // -- Reviews --------------------------------------------------------------

  saveReview(input: {
    reviewType: string;
    filePath?: string;
    issuesFound: number;
    suggestions: string[];
    result: string;
  }): Review {
    const stmt = this.db.prepare(
      'INSERT INTO reviews (reviewType, filePath, issuesFound, suggestions, result) VALUES (?, ?, ?, ?, ?)',
    );
    const res = stmt.run(
      input.reviewType,
      input.filePath ?? null,
      input.issuesFound,
      JSON.stringify(input.suggestions),
      input.result,
    );
    return this.getReview(Number(res.lastInsertRowid))!;
  }

  private getReview(id: number): Review | undefined {
    const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as
      | ReviewRow
      | undefined;
    return row ? toReview(row) : undefined;
  }

  listReviews(reviewType?: string, limit?: number): Review[] {
    const effectiveLimit = limit ?? 50;
    let rows: ReviewRow[];
    if (reviewType) {
      rows = this.db
        .prepare('SELECT * FROM reviews WHERE reviewType = ? ORDER BY createdAt DESC LIMIT ?')
        .all(reviewType, effectiveLimit) as ReviewRow[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM reviews ORDER BY createdAt DESC LIMIT ?')
        .all(effectiveLimit) as ReviewRow[];
    }
    return rows.map(toReview);
  }

  // -- Complexity Records ---------------------------------------------------

  saveComplexity(input: {
    filePath?: string;
    language: string;
    totalComplexity: number;
    rating: string;
    lineCount: number;
  }): ComplexityRecord {
    const stmt = this.db.prepare(
      'INSERT INTO complexity_records (filePath, language, totalComplexity, rating, lineCount) VALUES (?, ?, ?, ?, ?)',
    );
    const res = stmt.run(
      input.filePath ?? null,
      input.language,
      input.totalComplexity,
      input.rating,
      input.lineCount,
    );
    return this.getComplexityRecord(Number(res.lastInsertRowid))!;
  }

  private getComplexityRecord(id: number): ComplexityRecord | undefined {
    const row = this.db.prepare('SELECT * FROM complexity_records WHERE id = ?').get(id) as
      | ComplexityRecordRow
      | undefined;
    return row ? toComplexityRecord(row) : undefined;
  }

  listComplexityRecords(filePath?: string): ComplexityRecord[] {
    let rows: ComplexityRecordRow[];
    if (filePath) {
      rows = this.db
        .prepare('SELECT * FROM complexity_records WHERE filePath = ? ORDER BY createdAt DESC')
        .all(filePath) as ComplexityRecordRow[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM complexity_records ORDER BY createdAt DESC')
        .all() as ComplexityRecordRow[];
    }
    return rows.map(toComplexityRecord);
  }
}
