import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsStore } from '../../src/services/metrics-store.js';

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = new MetricsStore({ inMemory: true });
  });

  // ---------- Velocity Records ----------

  describe('saveVelocity', () => {
    it('should save a velocity record and return it with an id', () => {
      const record = store.saveVelocity({
        sprintName: 'Sprint 1',
        completedPoints: 21,
        totalPoints: 30,
        completionRate: 0.7,
      });

      expect(record.id).toBe(1);
      expect(record.sprintName).toBe('Sprint 1');
      expect(record.completedPoints).toBe(21);
      expect(record.totalPoints).toBe(30);
      expect(record.completionRate).toBe(0.7);
      expect(record.recordedAt).toBeDefined();
    });

    it('should auto-increment ids across multiple saves', () => {
      const r1 = store.saveVelocity({
        sprintName: 'Sprint 1',
        completedPoints: 20,
        totalPoints: 25,
        completionRate: 0.8,
      });
      const r2 = store.saveVelocity({
        sprintName: 'Sprint 2',
        completedPoints: 25,
        totalPoints: 30,
        completionRate: 0.83,
      });

      expect(r2.id).toBe(r1.id + 1);
    });
  });

  describe('getVelocityHistory', () => {
    it('should return an empty array when no records exist', () => {
      expect(store.getVelocityHistory()).toEqual([]);
    });

    it('should return all records when no limit is given', () => {
      for (let i = 0; i < 3; i++) {
        store.saveVelocity({
          sprintName: `Sprint ${i}`,
          completedPoints: i * 10,
          totalPoints: 30,
          completionRate: (i * 10) / 30,
        });
      }

      expect(store.getVelocityHistory()).toHaveLength(3);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveVelocity({
          sprintName: `Sprint ${i}`,
          completedPoints: 10,
          totalPoints: 20,
          completionRate: 0.5,
        });
      }

      const limited = store.getVelocityHistory(2);
      expect(limited).toHaveLength(2);
    });
  });

  // ---------- Metric Snapshots ----------

  describe('saveSnapshot', () => {
    it('should save a metric snapshot and return it', () => {
      const snap = store.saveSnapshot(
        'velocity',
        JSON.stringify({ avgPoints: 22 }),
      );

      expect(snap.id).toBe(1);
      expect(snap.metricType).toBe('velocity');
      expect(snap.result).toBe(JSON.stringify({ avgPoints: 22 }));
      expect(snap.createdAt).toBeDefined();
    });
  });

  describe('listSnapshots', () => {
    it('should return an empty array when no snapshots exist', () => {
      expect(store.listSnapshots()).toEqual([]);
    });

    it('should filter by metricType when provided', () => {
      store.saveSnapshot('velocity', '{"v":1}');
      store.saveSnapshot('burndown', '{"b":1}');
      store.saveSnapshot('velocity', '{"v":2}');

      const velocityOnly = store.listSnapshots('velocity');
      expect(velocityOnly).toHaveLength(2);
      expect(velocityOnly.every((s) => s.metricType === 'velocity')).toBe(true);
    });

    it('should return all snapshots when no filter is given', () => {
      store.saveSnapshot('velocity', '{}');
      store.saveSnapshot('burndown', '{}');

      expect(store.listSnapshots()).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should preserve JSON result string in snapshots', () => {
      const payload = JSON.stringify({ sprints: [1, 2, 3], avg: 15.5 });
      const snap = store.saveSnapshot('velocity', payload);

      expect(snap.result).toBe(payload);
      expect(JSON.parse(snap.result).sprints).toHaveLength(3);
    });
  });
});
