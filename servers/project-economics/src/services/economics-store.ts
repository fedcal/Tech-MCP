/**
 * SQLite storage for project economics data.
 * Manages budgets and cost tracking.
 */

import { createDatabase, runMigrations, type Migration } from '@mcp-suite/database';
import type Database from 'better-sqlite3';

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create budgets and costs tables',
    up: `
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT NOT NULL UNIQUE,
        totalBudget REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budgetId INTEGER NOT NULL REFERENCES budgets(id),
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        taskId TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    description: 'Create feature_costs table',
    up: `
      CREATE TABLE IF NOT EXISTS feature_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        featureId TEXT NOT NULL,
        projectName TEXT NOT NULL,
        totalCost REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        description TEXT,
        hoursSpent REAL NOT NULL DEFAULT 0,
        hourlyRate REAL NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_feature_costs_feature ON feature_costs(featureId);
      CREATE INDEX IF NOT EXISTS idx_feature_costs_project ON feature_costs(projectName);
    `,
  },
];

export interface Budget {
  id: number;
  projectName: string;
  totalBudget: number;
  currency: string;
  createdAt: string;
}

export interface Cost {
  id: number;
  budgetId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
  taskId: string | null;
  createdAt: string;
}

export interface BudgetStatus {
  projectName: string;
  totalBudget: number;
  currency: string;
  totalSpent: number;
  remaining: number;
  percentageUsed: number;
  breakdown: Array<{ category: string; total: number }>;
}

export interface BudgetForecast {
  projectName: string;
  totalBudget: number;
  currency: string;
  totalSpent: number;
  remaining: number;
  dailyBurnRate: number;
  daysTracked: number;
  estimatedDaysRemaining: number | null;
  estimatedRunOutDate: string | null;
}

export interface FeatureCost {
  id: number;
  featureId: string;
  projectName: string;
  totalCost: number;
  currency: string;
  description: string | null;
  hoursSpent: number;
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
}

export class EconomicsStore {
  private db: Database.Database;

  constructor(inMemory = false) {
    this.db = createDatabase({ serverName: 'project-economics', inMemory });
    runMigrations(this.db, migrations);
  }

  setBudget(projectName: string, totalBudget: number, currency: string = 'EUR'): Budget {
    const stmt = this.db.prepare(`
      INSERT INTO budgets (projectName, totalBudget, currency)
      VALUES (?, ?, ?)
      ON CONFLICT(projectName) DO UPDATE SET totalBudget = excluded.totalBudget, currency = excluded.currency
    `);
    stmt.run(projectName, totalBudget, currency);

    return this.db.prepare('SELECT * FROM budgets WHERE projectName = ?').get(projectName) as Budget;
  }

  logCost(
    projectName: string,
    category: string,
    amount: number,
    description: string,
    date?: string,
    taskId?: string,
  ): Cost {
    const budget = this.db.prepare('SELECT * FROM budgets WHERE projectName = ?').get(projectName) as
      | Budget
      | undefined;
    if (!budget) {
      throw new Error(`No budget found for project: ${projectName}`);
    }

    const costDate = date || new Date().toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      INSERT INTO costs (budgetId, category, amount, description, date, taskId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(budget.id, category, amount, description, costDate, taskId || null);

    return this.db.prepare('SELECT * FROM costs WHERE id = ?').get(result.lastInsertRowid) as Cost;
  }

  getBudgetStatus(projectName: string): BudgetStatus {
    const budget = this.db.prepare('SELECT * FROM budgets WHERE projectName = ?').get(projectName) as
      | Budget
      | undefined;
    if (!budget) {
      throw new Error(`No budget found for project: ${projectName}`);
    }

    const totalSpentRow = this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM costs WHERE budgetId = ?')
      .get(budget.id) as { total: number };
    const totalSpent = totalSpentRow.total;

    const breakdown = this.db
      .prepare(
        'SELECT category, SUM(amount) as total FROM costs WHERE budgetId = ? GROUP BY category ORDER BY total DESC',
      )
      .all(budget.id) as Array<{ category: string; total: number }>;

    const remaining = budget.totalBudget - totalSpent;
    const percentageUsed = budget.totalBudget > 0 ? (totalSpent / budget.totalBudget) * 100 : 0;

    return {
      projectName: budget.projectName,
      totalBudget: budget.totalBudget,
      currency: budget.currency,
      totalSpent,
      remaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      breakdown,
    };
  }

  getCostBreakdown(projectName: string): Array<{ category: string; total: number }> {
    const budget = this.db.prepare('SELECT * FROM budgets WHERE projectName = ?').get(projectName) as
      | Budget
      | undefined;
    if (!budget) {
      throw new Error(`No budget found for project: ${projectName}`);
    }

    return this.db
      .prepare(
        'SELECT category, SUM(amount) as total FROM costs WHERE budgetId = ? GROUP BY category ORDER BY total DESC',
      )
      .all(budget.id) as Array<{ category: string; total: number }>;
  }

  forecastBudget(projectName: string): BudgetForecast {
    const budget = this.db.prepare('SELECT * FROM budgets WHERE projectName = ?').get(projectName) as
      | Budget
      | undefined;
    if (!budget) {
      throw new Error(`No budget found for project: ${projectName}`);
    }

    const costs = this.db
      .prepare('SELECT * FROM costs WHERE budgetId = ? ORDER BY date ASC')
      .all(budget.id) as Cost[];

    const totalSpent = costs.reduce((sum, c) => sum + c.amount, 0);
    const remaining = budget.totalBudget - totalSpent;

    if (costs.length === 0) {
      return {
        projectName: budget.projectName,
        totalBudget: budget.totalBudget,
        currency: budget.currency,
        totalSpent: 0,
        remaining: budget.totalBudget,
        dailyBurnRate: 0,
        daysTracked: 0,
        estimatedDaysRemaining: null,
        estimatedRunOutDate: null,
      };
    }

    const firstDate = new Date(costs[0].date);
    const lastDate = new Date(costs[costs.length - 1].date);
    const daysTracked = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const dailyBurnRate = totalSpent / daysTracked;

    let estimatedDaysRemaining: number | null = null;
    let estimatedRunOutDate: string | null = null;

    if (dailyBurnRate > 0 && remaining > 0) {
      estimatedDaysRemaining = Math.ceil(remaining / dailyBurnRate);
      const runOutDate = new Date();
      runOutDate.setDate(runOutDate.getDate() + estimatedDaysRemaining);
      estimatedRunOutDate = runOutDate.toISOString().split('T')[0];
    } else if (remaining <= 0) {
      estimatedDaysRemaining = 0;
      estimatedRunOutDate = new Date().toISOString().split('T')[0];
    }

    return {
      projectName: budget.projectName,
      totalBudget: budget.totalBudget,
      currency: budget.currency,
      totalSpent,
      remaining,
      dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
      daysTracked,
      estimatedDaysRemaining,
      estimatedRunOutDate,
    };
  }

  // ── Feature Cost Tracking ──────────────────────────────────────

  costPerFeature(input: {
    featureId: string;
    projectName: string;
    hoursSpent: number;
    hourlyRate: number;
    description?: string;
    currency?: string;
  }): FeatureCost {
    const totalCost = input.hoursSpent * input.hourlyRate;
    const currency = input.currency ?? 'EUR';

    const existing = this.db
      .prepare('SELECT * FROM feature_costs WHERE featureId = ? AND projectName = ?')
      .get(input.featureId, input.projectName) as FeatureCost | undefined;

    if (existing) {
      const newHours = existing.hoursSpent + input.hoursSpent;
      const newTotal = existing.totalCost + totalCost;
      this.db.prepare(
        "UPDATE feature_costs SET hoursSpent = ?, totalCost = ?, hourlyRate = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(newHours, newTotal, input.hourlyRate, existing.id);
      return this.db.prepare('SELECT * FROM feature_costs WHERE id = ?').get(existing.id) as FeatureCost;
    }

    const stmt = this.db.prepare(
      'INSERT INTO feature_costs (featureId, projectName, totalCost, currency, description, hoursSpent, hourlyRate) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      input.featureId,
      input.projectName,
      totalCost,
      currency,
      input.description ?? null,
      input.hoursSpent,
      input.hourlyRate,
    );
    return this.db.prepare('SELECT * FROM feature_costs WHERE id = ?').get(Number(result.lastInsertRowid)) as FeatureCost;
  }

  getFeatureCost(featureId: string): FeatureCost | undefined {
    return this.db
      .prepare('SELECT * FROM feature_costs WHERE featureId = ? ORDER BY updatedAt DESC LIMIT 1')
      .get(featureId) as FeatureCost | undefined;
  }

  getAllFeatureCosts(projectName: string): FeatureCost[] {
    return this.db
      .prepare('SELECT * FROM feature_costs WHERE projectName = ? ORDER BY totalCost DESC')
      .all(projectName) as FeatureCost[];
  }
}
