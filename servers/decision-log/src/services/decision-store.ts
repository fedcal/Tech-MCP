/**
 * SQLite store for Architecture Decision Records (ADR).
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create decisions and decision_links tables',
    up: `
      CREATE TABLE decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        context TEXT NOT NULL,
        decision TEXT NOT NULL,
        alternatives TEXT NOT NULL DEFAULT '[]',
        consequences TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'proposed',
        relatedTickets TEXT NOT NULL DEFAULT '[]',
        supersededBy INTEGER,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE decision_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        decisionId INTEGER NOT NULL,
        linkType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (decisionId) REFERENCES decisions(id)
      );

      CREATE INDEX idx_decisions_status ON decisions(status);
      CREATE INDEX idx_decision_links_decision ON decision_links(decisionId);
    `,
  },
];

export interface Decision {
  id: number;
  title: string;
  context: string;
  decision: string;
  alternatives: string[];
  consequences: string;
  status: string;
  relatedTickets: string[];
  supersededBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface DecisionRow {
  id: number;
  title: string;
  context: string;
  decision: string;
  alternatives: string;
  consequences: string;
  status: string;
  relatedTickets: string;
  supersededBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionLinkRecord {
  id: number;
  decisionId: number;
  linkType: string;
  targetId: string;
  description: string | null;
  createdAt: string;
}

function rowToDecision(row: DecisionRow): Decision {
  return {
    ...row,
    alternatives: JSON.parse(row.alternatives) as string[],
    relatedTickets: JSON.parse(row.relatedTickets) as string[],
  };
}

export class DecisionStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'decision-log',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  recordDecision(input: {
    title: string;
    context: string;
    decision: string;
    alternatives?: string[];
    consequences?: string;
    status?: string;
    relatedTickets?: string[];
  }): Decision {
    const stmt = this.db.prepare(`
      INSERT INTO decisions (title, context, decision, alternatives, consequences, status, relatedTickets)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.title,
      input.context,
      input.decision,
      JSON.stringify(input.alternatives ?? []),
      input.consequences ?? '',
      input.status ?? 'proposed',
      JSON.stringify(input.relatedTickets ?? []),
    );
    return this.getDecision(Number(result.lastInsertRowid))!;
  }

  getDecision(id: number): Decision | undefined {
    const row = this.db
      .prepare('SELECT * FROM decisions WHERE id = ?')
      .get(id) as DecisionRow | undefined;
    return row ? rowToDecision(row) : undefined;
  }

  listDecisions(filters?: {
    status?: string;
    search?: string;
    limit?: number;
  }): Decision[] {
    let sql = 'SELECT * FROM decisions WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.search) {
      sql += ' AND (title LIKE ? OR context LIKE ? OR decision LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY createdAt DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as DecisionRow[];
    return rows.map(rowToDecision);
  }

  supersedeDecision(id: number, supersededById: number): Decision | undefined {
    this.db
      .prepare('UPDATE decisions SET status = ?, supersededBy = ?, updatedAt = datetime(\'now\') WHERE id = ?')
      .run('superseded', supersededById, id);
    return this.getDecision(id);
  }

  linkDecision(input: {
    decisionId: number;
    linkType: string;
    targetId: string;
    description?: string;
  }): DecisionLinkRecord {
    const stmt = this.db.prepare(`
      INSERT INTO decision_links (decisionId, linkType, targetId, description)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.decisionId,
      input.linkType,
      input.targetId,
      input.description ?? null,
    );
    return this.db
      .prepare('SELECT * FROM decision_links WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as DecisionLinkRecord;
  }

  getDecisionLinks(decisionId: number): DecisionLinkRecord[] {
    return this.db
      .prepare('SELECT * FROM decision_links WHERE decisionId = ? ORDER BY createdAt DESC')
      .all(decisionId) as DecisionLinkRecord[];
  }

  searchDecisions(query: string): Decision[] {
    return this.listDecisions({ search: query });
  }

  getDecisionsByStatus(status: string): Decision[] {
    return this.listDecisions({ status });
  }
}
