import { describe, it, expect, beforeEach } from 'vitest';
import { StandupStore } from '../../src/services/standup-store.js';

describe('StandupStore', () => {
  let store: StandupStore;

  beforeEach(() => {
    store = new StandupStore(true);
  });

  // ── logStandup ────────────────────────────────────────────────────────

  describe('logStandup', () => {
    it('should create a standup entry', () => {
      const standup = store.logStandup(
        'Completed feature A',
        'Working on feature B',
        'Waiting for code review',
      );

      expect(standup.id).toBeDefined();
      expect(standup.yesterday).toBe('Completed feature A');
      expect(standup.today).toBe('Working on feature B');
      expect(standup.blockers).toBe('Waiting for code review');
      expect(standup.userId).toBe('default');
      expect(standup.date).toBeDefined();
    });

    it('should allow null blockers', () => {
      const standup = store.logStandup('Did X', 'Will do Y');
      expect(standup.blockers).toBeNull();
    });

    it('should create multiple standups', () => {
      store.logStandup('A', 'B');
      store.logStandup('C', 'D');

      const history = store.getStandupHistory(30);
      expect(history).toHaveLength(2);
    });
  });

  // ── getStandupHistory ─────────────────────────────────────────────────

  describe('getStandupHistory', () => {
    it('should return recent standups', () => {
      store.logStandup('Yesterday 1', 'Today 1');
      store.logStandup('Yesterday 2', 'Today 2');

      const history = store.getStandupHistory(7);
      expect(history).toHaveLength(2);
      const yesterdays = history.map((s) => s.yesterday);
      expect(yesterdays).toContain('Yesterday 1');
      expect(yesterdays).toContain('Yesterday 2');
    });

    it('should return empty array when no standups exist', () => {
      const history = store.getStandupHistory(7);
      expect(history).toEqual([]);
    });

    it('should use default days=7 parameter', () => {
      store.logStandup('A', 'B');
      const history = store.getStandupHistory();
      expect(history).toHaveLength(1);
    });
  });

  // ── generateStatusReport ──────────────────────────────────────────────

  describe('generateStatusReport', () => {
    it('should generate a status report from recent standups', () => {
      store.logStandup('Finished task A', 'Starting task B', 'Blocked by API');
      store.logStandup('Finished task C', 'Starting task D');

      const report = store.generateStatusReport(7);

      expect(report.totalStandups).toBe(2);
      expect(report.accomplishments).toHaveLength(2);
      expect(report.currentWork).toHaveLength(2);
      expect(report.blockers).toHaveLength(1);
      expect(report.period.days).toBe(7);
      expect(report.report).toContain('Status Report');
      expect(report.report).toContain('Accomplishments');
    });

    it('should return empty report when no standups exist', () => {
      const report = store.generateStatusReport(7);

      expect(report.totalStandups).toBe(0);
      expect(report.accomplishments).toHaveLength(0);
      expect(report.currentWork).toHaveLength(0);
      expect(report.blockers).toHaveLength(0);
      expect(report.report).toContain('None reported');
    });

    it('should use default days=7 parameter', () => {
      store.logStandup('A', 'B');
      const report = store.generateStatusReport();
      expect(report.period.days).toBe(7);
    });
  });
});
