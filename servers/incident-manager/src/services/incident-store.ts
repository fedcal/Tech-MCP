/**
 * SQLite store for Incident lifecycle management.
 */

import type Database from 'better-sqlite3';
import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create incidents and incident_timeline tables',
    up: `
      CREATE TABLE incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        affectedSystems TEXT NOT NULL DEFAULT '[]',
        resolution TEXT,
        rootCause TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        resolvedAt TEXT
      );

      CREATE TABLE incident_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incidentId INTEGER NOT NULL,
        description TEXT NOT NULL,
        source TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (incidentId) REFERENCES incidents(id)
      );

      CREATE INDEX idx_incidents_status ON incidents(status);
      CREATE INDEX idx_incidents_severity ON incidents(severity);
      CREATE INDEX idx_incident_timeline_incident ON incident_timeline(incidentId);
    `,
  },
];

export interface Incident {
  id: number;
  title: string;
  severity: string;
  description: string;
  status: string;
  affectedSystems: string[];
  resolution: string | null;
  rootCause: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface IncidentRow {
  id: number;
  title: string;
  severity: string;
  description: string;
  status: string;
  affectedSystems: string;
  resolution: string | null;
  rootCause: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TimelineEntryRow {
  id: number;
  incidentId: number;
  description: string;
  source: string | null;
  timestamp: string;
}

function rowToIncident(row: IncidentRow): Incident {
  return {
    ...row,
    affectedSystems: JSON.parse(row.affectedSystems) as string[],
  };
}

export class IncidentStore {
  private db: Database.Database;

  constructor(options?: { inMemory?: boolean; dataDir?: string }) {
    this.db = createDatabase({
      serverName: 'incident-manager',
      inMemory: options?.inMemory,
      dataDir: options?.dataDir,
    });
    runMigrations(this.db, migrations);
  }

  openIncident(input: {
    title: string;
    severity: string;
    description: string;
    affectedSystems?: string[];
  }): Incident {
    const stmt = this.db.prepare(`
      INSERT INTO incidents (title, severity, description, affectedSystems)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.title,
      input.severity,
      input.description,
      JSON.stringify(input.affectedSystems ?? []),
    );

    const incident = this.getIncident(Number(result.lastInsertRowid))!;

    this.addTimelineEntry(incident.id, `Incident opened: ${input.title} [${input.severity}]`);

    return incident;
  }

  getIncident(id: number): Incident | undefined {
    const row = this.db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .get(id) as IncidentRow | undefined;
    return row ? rowToIncident(row) : undefined;
  }

  updateIncident(
    id: number,
    updates: { status?: string; note?: string },
  ): Incident | undefined {
    const existing = this.getIncident(id);
    if (!existing) return undefined;

    if (updates.status) {
      this.db
        .prepare('UPDATE incidents SET status = ? WHERE id = ?')
        .run(updates.status, id);
    }

    if (updates.note) {
      this.addTimelineEntry(id, updates.note);
    }

    return this.getIncident(id);
  }

  addTimelineEntry(incidentId: number, description: string, source?: string): TimelineEntryRow {
    const stmt = this.db.prepare(`
      INSERT INTO incident_timeline (incidentId, description, source)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(incidentId, description, source ?? null);
    return this.db
      .prepare('SELECT * FROM incident_timeline WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as TimelineEntryRow;
  }

  resolveIncident(
    id: number,
    resolution: string,
    rootCause?: string,
  ): Incident | undefined {
    const existing = this.getIncident(id);
    if (!existing) return undefined;

    this.db
      .prepare(
        'UPDATE incidents SET status = ?, resolution = ?, rootCause = ?, resolvedAt = datetime(\'now\') WHERE id = ?',
      )
      .run('resolved', resolution, rootCause ?? null, id);

    this.addTimelineEntry(id, `Incident resolved: ${resolution}`);

    return this.getIncident(id);
  }

  getTimeline(incidentId: number): TimelineEntryRow[] {
    return this.db
      .prepare('SELECT * FROM incident_timeline WHERE incidentId = ? ORDER BY timestamp ASC')
      .all(incidentId) as TimelineEntryRow[];
  }

  listIncidents(filters?: {
    status?: string;
    severity?: string;
    limit?: number;
  }): Incident[] {
    let sql = 'SELECT * FROM incidents WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.severity) {
      sql += ' AND severity = ?';
      params.push(filters.severity);
    }

    sql += ' ORDER BY createdAt DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as IncidentRow[];
    return rows.map(rowToIncident);
  }

  generatePostmortemData(id: number): {
    incident: Incident;
    timeline: TimelineEntryRow[];
    durationMinutes: number;
  } | undefined {
    const incident = this.getIncident(id);
    if (!incident) return undefined;

    const timeline = this.getTimeline(id);

    let durationMinutes = 0;
    if (incident.resolvedAt && incident.createdAt) {
      const created = new Date(incident.createdAt).getTime();
      const resolved = new Date(incident.resolvedAt).getTime();
      durationMinutes = Math.round((resolved - created) / (1000 * 60));
    }

    return { incident, timeline, durationMinutes };
  }
}
