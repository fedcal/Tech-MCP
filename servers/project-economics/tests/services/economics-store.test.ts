import { describe, it, expect, beforeEach } from 'vitest';
import { EconomicsStore } from '../../src/services/economics-store.js';

describe('EconomicsStore', () => {
  let store: EconomicsStore;

  beforeEach(() => {
    store = new EconomicsStore(true);
  });

  // ── setBudget ─────────────────────────────────────────────────────────

  describe('setBudget', () => {
    it('should create a new budget for a project', () => {
      const budget = store.setBudget('ProjectX', 50000, 'EUR');

      expect(budget.id).toBeDefined();
      expect(budget.projectName).toBe('ProjectX');
      expect(budget.totalBudget).toBe(50000);
      expect(budget.currency).toBe('EUR');
    });

    it('should upsert (update) budget if project already exists', () => {
      store.setBudget('ProjectX', 50000, 'EUR');
      const updated = store.setBudget('ProjectX', 75000, 'USD');

      expect(updated.totalBudget).toBe(75000);
      expect(updated.currency).toBe('USD');
    });

    it('should default currency to EUR', () => {
      const budget = store.setBudget('ProjectY', 10000);
      expect(budget.currency).toBe('EUR');
    });
  });

  // ── logCost ───────────────────────────────────────────────────────────

  describe('logCost', () => {
    it('should log a cost against an existing budget', () => {
      store.setBudget('ProjectX', 50000);

      const cost = store.logCost('ProjectX', 'development', 5000, 'Backend work', '2025-03-01');

      expect(cost.id).toBeDefined();
      expect(cost.category).toBe('development');
      expect(cost.amount).toBe(5000);
      expect(cost.description).toBe('Backend work');
      expect(cost.date).toBe('2025-03-01');
    });

    it('should throw when logging a cost for a non-existent project', () => {
      expect(() =>
        store.logCost('NonExistent', 'dev', 100, 'test'),
      ).toThrow(/no budget found/i);
    });

    it('should accept optional taskId', () => {
      store.setBudget('ProjectX', 50000);
      const cost = store.logCost('ProjectX', 'infra', 200, 'Cloud', '2025-03-01', 'TASK-42');
      expect(cost.taskId).toBe('TASK-42');
    });
  });

  // ── getBudgetStatus ───────────────────────────────────────────────────

  describe('getBudgetStatus', () => {
    it('should return budget status with spent amount and breakdown', () => {
      store.setBudget('ProjectX', 50000);
      store.logCost('ProjectX', 'development', 10000, 'Dev work', '2025-03-01');
      store.logCost('ProjectX', 'infra', 5000, 'Cloud', '2025-03-02');

      const status = store.getBudgetStatus('ProjectX');

      expect(status.projectName).toBe('ProjectX');
      expect(status.totalBudget).toBe(50000);
      expect(status.totalSpent).toBe(15000);
      expect(status.remaining).toBe(35000);
      expect(status.percentageUsed).toBe(30);
      expect(status.breakdown).toHaveLength(2);
    });

    it('should throw for a non-existent project', () => {
      expect(() => store.getBudgetStatus('NoProject')).toThrow(/no budget found/i);
    });

    it('should return zero spent when no costs logged', () => {
      store.setBudget('EmptyProject', 20000);
      const status = store.getBudgetStatus('EmptyProject');

      expect(status.totalSpent).toBe(0);
      expect(status.remaining).toBe(20000);
      expect(status.percentageUsed).toBe(0);
    });
  });

  // ── getCostBreakdown ──────────────────────────────────────────────────

  describe('getCostBreakdown', () => {
    it('should return category breakdowns', () => {
      store.setBudget('ProjectX', 50000);
      store.logCost('ProjectX', 'dev', 10000, 'D1', '2025-03-01');
      store.logCost('ProjectX', 'dev', 5000, 'D2', '2025-03-02');
      store.logCost('ProjectX', 'infra', 3000, 'I1', '2025-03-03');

      const breakdown = store.getCostBreakdown('ProjectX');

      expect(breakdown).toHaveLength(2);
      // Ordered by total DESC
      expect(breakdown[0].category).toBe('dev');
      expect(breakdown[0].total).toBe(15000);
      expect(breakdown[1].category).toBe('infra');
      expect(breakdown[1].total).toBe(3000);
    });

    it('should throw for a non-existent project', () => {
      expect(() => store.getCostBreakdown('NoProject')).toThrow(/no budget found/i);
    });
  });

  // ── forecastBudget ────────────────────────────────────────────────────

  describe('forecastBudget', () => {
    it('should return a forecast with burn rate and estimated days remaining', () => {
      store.setBudget('ProjectX', 50000);
      store.logCost('ProjectX', 'dev', 5000, 'Day1', '2025-03-01');
      store.logCost('ProjectX', 'dev', 5000, 'Day2', '2025-03-02');

      const forecast = store.forecastBudget('ProjectX');

      expect(forecast.projectName).toBe('ProjectX');
      expect(forecast.totalSpent).toBe(10000);
      expect(forecast.remaining).toBe(40000);
      expect(forecast.daysTracked).toBeGreaterThanOrEqual(1);
      expect(forecast.dailyBurnRate).toBeGreaterThan(0);
      expect(forecast.estimatedDaysRemaining).toBeGreaterThan(0);
      expect(forecast.estimatedRunOutDate).toBeDefined();
    });

    it('should return null estimates when no costs exist', () => {
      store.setBudget('ProjectX', 50000);

      const forecast = store.forecastBudget('ProjectX');

      expect(forecast.totalSpent).toBe(0);
      expect(forecast.dailyBurnRate).toBe(0);
      expect(forecast.estimatedDaysRemaining).toBeNull();
      expect(forecast.estimatedRunOutDate).toBeNull();
    });

    it('should throw for a non-existent project', () => {
      expect(() => store.forecastBudget('NoProject')).toThrow(/no budget found/i);
    });
  });
});
