import { describe, it, expect, beforeEach } from 'vitest';
import { TimeStore } from '../../src/services/time-store.js';

describe('TimeStore', () => {
  let store: TimeStore;

  beforeEach(() => {
    store = new TimeStore({ inMemory: true });
  });

  // ── logTime ───────────────────────────────────────────────────────────

  describe('logTime', () => {
    it('should create a time entry with manual duration', () => {
      const entry = store.logTime('TASK-1', 90, 'Worked on feature', '2025-03-01');

      expect(entry.id).toBeDefined();
      expect(entry.taskId).toBe('TASK-1');
      expect(entry.durationMinutes).toBe(90);
      expect(entry.description).toBe('Worked on feature');
      expect(entry.date).toBe('2025-03-01');
      expect(entry.startTime).toBeNull();
      expect(entry.endTime).toBeNull();
    });

    it('should use default userId when not provided', () => {
      const entry = store.logTime('TASK-2', 30);
      expect(entry.userId).toBe('default');
    });

    it('should use provided userId', () => {
      const entry = store.logTime('TASK-3', 45, 'desc', '2025-03-01', 'alice');
      expect(entry.userId).toBe('alice');
    });
  });

  // ── Timer start/stop ──────────────────────────────────────────────────

  describe('startTimer / stopTimer', () => {
    it('should start and stop a timer, creating a time entry', () => {
      const timer = store.startTimer('TASK-1', 'Working on it');

      expect(timer.taskId).toBe('TASK-1');
      expect(timer.description).toBe('Working on it');
      expect(timer.startTime).toBeDefined();

      const entry = store.stopTimer();
      expect(entry.taskId).toBe('TASK-1');
      expect(entry.startTime).toBeDefined();
      expect(entry.endTime).toBeDefined();
      expect(entry.durationMinutes).toBeGreaterThanOrEqual(0);
    });

    it('should throw when starting a timer while one is already active', () => {
      store.startTimer('TASK-1');
      expect(() => store.startTimer('TASK-2')).toThrow(/active timer already exists/i);
    });

    it('should throw when stopping with no active timer', () => {
      expect(() => store.stopTimer()).toThrow(/no active timer/i);
    });
  });

  // ── getActiveTimer ────────────────────────────────────────────────────

  describe('getActiveTimer', () => {
    it('should return the active timer for a user', () => {
      store.startTimer('TASK-1', 'desc', 'bob');
      const timer = store.getActiveTimer('bob');

      expect(timer).not.toBeNull();
      expect(timer!.taskId).toBe('TASK-1');
    });

    it('should return null when there is no active timer', () => {
      expect(store.getActiveTimer()).toBeNull();
    });
  });

  // ── getTimesheet ──────────────────────────────────────────────────────

  describe('getTimesheet', () => {
    it('should return all entries and total minutes for a user', () => {
      store.logTime('TASK-1', 60, 'A', '2025-03-01');
      store.logTime('TASK-2', 30, 'B', '2025-03-02');

      const sheet = store.getTimesheet();
      expect(sheet.entries).toHaveLength(2);
      expect(sheet.totalMinutes).toBe(90);
    });

    it('should filter by date range', () => {
      store.logTime('TASK-1', 60, 'A', '2025-03-01');
      store.logTime('TASK-2', 30, 'B', '2025-03-05');
      store.logTime('TASK-3', 45, 'C', '2025-03-10');

      const sheet = store.getTimesheet(undefined, '2025-03-02', '2025-03-08');
      expect(sheet.entries).toHaveLength(1);
      expect(sheet.totalMinutes).toBe(30);
    });
  });

  // ── getTaskTime ───────────────────────────────────────────────────────

  describe('getTaskTime', () => {
    it('should aggregate time for a specific task', () => {
      store.logTime('TASK-1', 60, 'A', '2025-03-01');
      store.logTime('TASK-1', 30, 'B', '2025-03-02');
      store.logTime('TASK-2', 120, 'C', '2025-03-01');

      const result = store.getTaskTime('TASK-1');
      expect(result.taskId).toBe('TASK-1');
      expect(result.totalMinutes).toBe(90);
      expect(result.entries).toHaveLength(2);
    });

    it('should return 0 minutes for a task with no entries', () => {
      const result = store.getTaskTime('NONEXISTENT');
      expect(result.totalMinutes).toBe(0);
      expect(result.entries).toHaveLength(0);
    });
  });

  // ── editEntry ─────────────────────────────────────────────────────────

  describe('editEntry', () => {
    it('should update fields of an existing entry', () => {
      const entry = store.logTime('TASK-1', 60, 'Original', '2025-03-01');

      const updated = store.editEntry(entry.id, {
        durationMinutes: 90,
        description: 'Updated',
      });

      expect(updated.durationMinutes).toBe(90);
      expect(updated.description).toBe('Updated');
      expect(updated.taskId).toBe('TASK-1');
    });

    it('should throw for non-existent entry', () => {
      expect(() => store.editEntry(9999, { durationMinutes: 10 })).toThrow(/not found/i);
    });
  });

  // ── deleteEntry ───────────────────────────────────────────────────────

  describe('deleteEntry', () => {
    it('should delete an existing entry', () => {
      const entry = store.logTime('TASK-1', 60);
      const result = store.deleteEntry(entry.id);
      expect(result).toBe(true);

      // Verify it is gone
      const sheet = store.getTimesheet();
      expect(sheet.entries).toHaveLength(0);
    });

    it('should throw for non-existent entry', () => {
      expect(() => store.deleteEntry(9999)).toThrow(/not found/i);
    });
  });
});
