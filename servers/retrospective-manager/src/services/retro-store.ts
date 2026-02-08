/**
 * SQLite storage for retrospective data.
 * Manages retros, items, votes, and action items.
 */

import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';
import type Database from 'better-sqlite3';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create retros, retro_items, and action_items tables',
    up: `
      CREATE TABLE IF NOT EXISTS retros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sprintId TEXT,
        format TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS retro_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        retroId INTEGER NOT NULL REFERENCES retros(id),
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        votes INTEGER NOT NULL DEFAULT 0,
        authorId TEXT
      );

      CREATE TABLE IF NOT EXISTS action_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        retroId INTEGER NOT NULL REFERENCES retros(id),
        description TEXT NOT NULL,
        assignee TEXT,
        dueDate TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    description: 'Create retro_patterns and event_suggestions tables',
    up: `
      CREATE TABLE IF NOT EXISTS retro_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        category TEXT NOT NULL,
        occurrences INTEGER NOT NULL DEFAULT 1,
        retroIds TEXT NOT NULL DEFAULT '[]',
        firstSeen TEXT NOT NULL DEFAULT (datetime('now')),
        lastSeen TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_retro_patterns_category ON retro_patterns(category);

      CREATE TABLE IF NOT EXISTS event_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventType TEXT NOT NULL,
        description TEXT NOT NULL,
        sourceData TEXT NOT NULL DEFAULT '{}',
        used INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

export type RetroFormat = 'mad-sad-glad' | '4ls' | 'start-stop-continue';

export interface Retro {
  id: number;
  sprintId: string | null;
  format: RetroFormat;
  status: string;
  createdAt: string;
}

export interface RetroItem {
  id: number;
  retroId: number;
  category: string;
  content: string;
  votes: number;
  authorId: string | null;
}

export interface ActionItem {
  id: number;
  retroId: number;
  description: string;
  assignee: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
}

export interface FullRetro {
  retro: Retro;
  categories: Record<string, RetroItem[]>;
  actionItems: ActionItem[];
}

export interface RetroPattern {
  id: number;
  pattern: string;
  category: string;
  occurrences: number;
  retroIds: number[];
  firstSeen: string;
  lastSeen: string;
}

interface RetroPatternRow {
  id: number;
  pattern: string;
  category: string;
  occurrences: number;
  retroIds: string;
  firstSeen: string;
  lastSeen: string;
}

export interface EventSuggestion {
  id: number;
  eventType: string;
  description: string;
  sourceData: Record<string, unknown>;
  used: boolean;
  createdAt: string;
}

interface EventSuggestionRow {
  id: number;
  eventType: string;
  description: string;
  sourceData: string;
  used: number;
  createdAt: string;
}

const FORMAT_CATEGORIES: Record<RetroFormat, string[]> = {
  'mad-sad-glad': ['mad', 'sad', 'glad'],
  '4ls': ['liked', 'learned', 'lacked', 'longed-for'],
  'start-stop-continue': ['start', 'stop', 'continue'],
};

export class RetroStore {
  private db: Database.Database;

  constructor(inMemory = false) {
    this.db = createDatabase({ serverName: 'retrospective-manager', inMemory });
    runMigrations(this.db, migrations);
  }

  createRetro(format: RetroFormat, sprintId?: string): FullRetro {
    const stmt = this.db.prepare('INSERT INTO retros (sprintId, format) VALUES (?, ?)');
    const result = stmt.run(sprintId || null, format);

    const retro = this.db.prepare('SELECT * FROM retros WHERE id = ?').get(result.lastInsertRowid) as Retro;

    const categories: Record<string, RetroItem[]> = {};
    for (const cat of FORMAT_CATEGORIES[format]) {
      categories[cat] = [];
    }

    return { retro, categories, actionItems: [] };
  }

  addItem(retroId: number, category: string, content: string, authorId?: string): RetroItem {
    const retro = this.db.prepare('SELECT * FROM retros WHERE id = ?').get(retroId) as Retro | undefined;
    if (!retro) {
      throw new Error(`No retrospective found with id: ${retroId}`);
    }

    const validCategories = FORMAT_CATEGORIES[retro.format as RetroFormat];
    if (validCategories && !validCategories.includes(category)) {
      throw new Error(
        `Invalid category "${category}" for format "${retro.format}". Valid categories: ${validCategories.join(', ')}`,
      );
    }

    const stmt = this.db.prepare(
      'INSERT INTO retro_items (retroId, category, content, authorId) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(retroId, category, content, authorId || null);

    return this.db.prepare('SELECT * FROM retro_items WHERE id = ?').get(result.lastInsertRowid) as RetroItem;
  }

  voteItem(itemId: number): RetroItem {
    const item = this.db.prepare('SELECT * FROM retro_items WHERE id = ?').get(itemId) as RetroItem | undefined;
    if (!item) {
      throw new Error(`No retro item found with id: ${itemId}`);
    }

    this.db.prepare('UPDATE retro_items SET votes = votes + 1 WHERE id = ?').run(itemId);

    return this.db.prepare('SELECT * FROM retro_items WHERE id = ?').get(itemId) as RetroItem;
  }

  generateActionItems(retroId: number, topN: number = 3): ActionItem[] {
    const retro = this.db.prepare('SELECT * FROM retros WHERE id = ?').get(retroId) as Retro | undefined;
    if (!retro) {
      throw new Error(`No retrospective found with id: ${retroId}`);
    }

    const topItems = this.db
      .prepare('SELECT * FROM retro_items WHERE retroId = ? ORDER BY votes DESC LIMIT ?')
      .all(retroId, topN) as RetroItem[];

    const insertStmt = this.db.prepare(
      'INSERT INTO action_items (retroId, description) VALUES (?, ?)',
    );

    const actionItems: ActionItem[] = [];
    for (const item of topItems) {
      const description = `[${item.category}] ${item.content}`;
      const result = insertStmt.run(retroId, description);
      const actionItem = this.db
        .prepare('SELECT * FROM action_items WHERE id = ?')
        .get(result.lastInsertRowid) as ActionItem;
      actionItems.push(actionItem);
    }

    return actionItems;
  }

  getRetro(retroId: number): FullRetro {
    const retro = this.db.prepare('SELECT * FROM retros WHERE id = ?').get(retroId) as Retro | undefined;
    if (!retro) {
      throw new Error(`No retrospective found with id: ${retroId}`);
    }

    const items = this.db
      .prepare('SELECT * FROM retro_items WHERE retroId = ? ORDER BY votes DESC')
      .all(retroId) as RetroItem[];

    const categories: Record<string, RetroItem[]> = {};
    const validCategories = FORMAT_CATEGORIES[retro.format as RetroFormat] || [];
    for (const cat of validCategories) {
      categories[cat] = [];
    }
    for (const item of items) {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    }

    const actionItems = this.db
      .prepare('SELECT * FROM action_items WHERE retroId = ? ORDER BY createdAt ASC')
      .all(retroId) as ActionItem[];

    return { retro, categories, actionItems };
  }

  // ── Pattern Detection ──────────────────────────────────────────

  detectPatterns(): RetroPattern[] {
    // Get all retro items grouped by content similarity
    const items = this.db
      .prepare('SELECT * FROM retro_items ORDER BY retroId ASC')
      .all() as RetroItem[];

    // Simple pattern detection: group by lowercased content words
    const patternMap = new Map<string, { category: string; retroIds: Set<number>; content: string }>();

    for (const item of items) {
      // Normalize: lowercase, trim
      const normalized = item.content.toLowerCase().trim();
      // Use first 3 significant words as pattern key
      const words = normalized.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (words.length === 0) continue;
      const key = words.join(' ');

      if (patternMap.has(key)) {
        patternMap.get(key)!.retroIds.add(item.retroId);
      } else {
        patternMap.set(key, {
          category: item.category,
          retroIds: new Set([item.retroId]),
          content: item.content,
        });
      }
    }

    // Only keep patterns seen in 2+ retros
    const patterns: RetroPattern[] = [];
    for (const [, data] of patternMap) {
      if (data.retroIds.size >= 2) {
        const retroIdArray = Array.from(data.retroIds);
        const saved = this.savePattern({
          pattern: data.content,
          category: data.category,
          occurrences: data.retroIds.size,
          retroIds: retroIdArray,
        });
        patterns.push(saved);
      }
    }

    return patterns;
  }

  savePattern(input: {
    pattern: string;
    category: string;
    occurrences: number;
    retroIds: number[];
  }): RetroPattern {
    // Check if pattern already exists
    const existing = this.db
      .prepare('SELECT * FROM retro_patterns WHERE pattern = ?')
      .get(input.pattern) as RetroPatternRow | undefined;

    if (existing) {
      const existingIds = JSON.parse(existing.retroIds) as number[];
      const mergedIds = Array.from(new Set([...existingIds, ...input.retroIds]));
      this.db.prepare(
        'UPDATE retro_patterns SET occurrences = ?, retroIds = ?, lastSeen = datetime(\'now\') WHERE id = ?'
      ).run(mergedIds.length, JSON.stringify(mergedIds), existing.id);
      const row = this.db.prepare('SELECT * FROM retro_patterns WHERE id = ?').get(existing.id) as RetroPatternRow;
      return { ...row, retroIds: JSON.parse(row.retroIds) as number[] };
    }

    const stmt = this.db.prepare(
      'INSERT INTO retro_patterns (pattern, category, occurrences, retroIds) VALUES (?, ?, ?, ?)',
    );
    const result = stmt.run(input.pattern, input.category, input.occurrences, JSON.stringify(input.retroIds));
    const row = this.db.prepare('SELECT * FROM retro_patterns WHERE id = ?').get(Number(result.lastInsertRowid)) as RetroPatternRow;
    return { ...row, retroIds: JSON.parse(row.retroIds) as number[] };
  }

  getPatterns(limit: number = 20): RetroPattern[] {
    const rows = this.db
      .prepare('SELECT * FROM retro_patterns ORDER BY occurrences DESC LIMIT ?')
      .all(limit) as RetroPatternRow[];
    return rows.map(r => ({ ...r, retroIds: JSON.parse(r.retroIds) as number[] }));
  }

  // ── Event Suggestions ──────────────────────────────────────────

  addEventSuggestion(eventType: string, description: string, sourceData?: Record<string, unknown>): EventSuggestion {
    const stmt = this.db.prepare(
      'INSERT INTO event_suggestions (eventType, description, sourceData) VALUES (?, ?, ?)',
    );
    const result = stmt.run(eventType, description, JSON.stringify(sourceData ?? {}));
    const row = this.db.prepare('SELECT * FROM event_suggestions WHERE id = ?').get(Number(result.lastInsertRowid)) as EventSuggestionRow;
    return { ...row, sourceData: JSON.parse(row.sourceData) as Record<string, unknown>, used: row.used === 1 };
  }

  getSuggestedItems(limit: number = 10): EventSuggestion[] {
    const rows = this.db
      .prepare('SELECT * FROM event_suggestions WHERE used = 0 ORDER BY createdAt DESC LIMIT ?')
      .all(limit) as EventSuggestionRow[];
    return rows.map(r => ({ ...r, sourceData: JSON.parse(r.sourceData) as Record<string, unknown>, used: r.used === 1 }));
  }

  markSuggestionUsed(id: number): void {
    this.db.prepare('UPDATE event_suggestions SET used = 1 WHERE id = ?').run(id);
  }
}
