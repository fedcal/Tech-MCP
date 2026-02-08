import { describe, it, expect, beforeEach } from 'vitest';
import { LogStore } from '../../src/services/log-store.js';

describe('LogStore', () => {
  let store: LogStore;

  beforeEach(() => {
    store = new LogStore({ inMemory: true });
  });

  // ---------- Analysis Results ----------

  describe('saveAnalysis', () => {
    it('should save an analysis result and return it with an id', () => {
      const result = store.saveAnalysis({
        filePath: '/var/log/app.log',
        totalLines: 1500,
        levels: { error: 20, warn: 50, info: 1430 },
        topErrors: [
          { message: 'Connection refused', count: 12 },
          { message: 'Timeout', count: 8 },
        ],
      });

      expect(result.id).toBe(1);
      expect(result.filePath).toBe('/var/log/app.log');
      expect(result.totalLines).toBe(1500);
      expect(result.levels).toEqual({ error: 20, warn: 50, info: 1430 });
      expect(result.topErrors).toHaveLength(2);
      expect(result.topErrors[0].message).toBe('Connection refused');
      expect(result.analyzedAt).toBeDefined();
    });

    it('should auto-increment ids', () => {
      const r1 = store.saveAnalysis({
        filePath: '/a.log',
        totalLines: 10,
        levels: {},
        topErrors: [],
      });
      const r2 = store.saveAnalysis({
        filePath: '/b.log',
        totalLines: 20,
        levels: {},
        topErrors: [],
      });

      expect(r2.id).toBe(r1.id + 1);
    });
  });

  describe('getLatestAnalysis', () => {
    it('should return an analysis for the given file path', () => {
      const saved = store.saveAnalysis({
        filePath: '/app.log',
        totalLines: 100,
        levels: { error: 5 },
        topErrors: [],
      });
      store.saveAnalysis({
        filePath: '/other.log',
        totalLines: 999,
        levels: { error: 99 },
        topErrors: [],
      });

      const latest = store.getLatestAnalysis('/app.log');
      expect(latest).toBeDefined();
      expect(latest!.id).toBe(saved.id);
      expect(latest!.filePath).toBe('/app.log');
      expect(latest!.totalLines).toBe(100);
    });

    it('should return undefined when no analysis exists for path', () => {
      expect(store.getLatestAnalysis('/nonexistent.log')).toBeUndefined();
    });
  });

  describe('listAnalyses', () => {
    it('should return an empty array when no analyses exist', () => {
      expect(store.listAnalyses()).toEqual([]);
    });

    it('should return all analyses', () => {
      store.saveAnalysis({ filePath: '/a.log', totalLines: 10, levels: {}, topErrors: [] });
      store.saveAnalysis({ filePath: '/b.log', totalLines: 20, levels: {}, topErrors: [] });

      expect(store.listAnalyses()).toHaveLength(2);
    });
  });

  // ---------- Error Patterns ----------

  describe('saveErrorPatterns', () => {
    it('should save error patterns and return them', () => {
      const record = store.saveErrorPatterns({
        filePath: '/app.log',
        patterns: [
          {
            pattern: 'NullPointerException',
            count: 15,
            examples: ['line 42: NullPointerException in UserService'],
          },
          {
            pattern: 'ConnectionTimeout',
            count: 8,
            examples: ['line 100: ConnectionTimeout to db-host'],
          },
        ],
      });

      expect(record.id).toBe(1);
      expect(record.filePath).toBe('/app.log');
      expect(record.patterns).toHaveLength(2);
      expect(record.patterns[0].pattern).toBe('NullPointerException');
      expect(record.patterns[0].count).toBe(15);
      expect(record.patterns[0].examples).toHaveLength(1);
      expect(record.detectedAt).toBeDefined();
    });
  });

  describe('listErrorPatterns', () => {
    it('should return an empty array when no patterns exist', () => {
      expect(store.listErrorPatterns()).toEqual([]);
    });

    it('should filter by filePath when provided', () => {
      store.saveErrorPatterns({
        filePath: '/a.log',
        patterns: [{ pattern: 'err1', count: 1, examples: [] }],
      });
      store.saveErrorPatterns({
        filePath: '/b.log',
        patterns: [{ pattern: 'err2', count: 2, examples: [] }],
      });

      const filtered = store.listErrorPatterns('/a.log');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].filePath).toBe('/a.log');
    });

    it('should return all patterns when no filter is given', () => {
      store.saveErrorPatterns({
        filePath: '/a.log',
        patterns: [],
      });
      store.saveErrorPatterns({
        filePath: '/b.log',
        patterns: [],
      });

      expect(store.listErrorPatterns()).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should serialize and deserialize levels as Record<string, number>', () => {
      const levels = { error: 10, warn: 25, info: 500, debug: 1000 };
      const result = store.saveAnalysis({
        filePath: '/test.log',
        totalLines: 1535,
        levels,
        topErrors: [],
      });

      expect(result.levels).toEqual(levels);
      expect(typeof result.levels).toBe('object');
    });

    it('should serialize and deserialize topErrors as array of objects', () => {
      const topErrors = [
        { message: 'Error A', count: 50 },
        { message: 'Error B', count: 30 },
      ];
      const result = store.saveAnalysis({
        filePath: '/test.log',
        totalLines: 100,
        levels: {},
        topErrors,
      });

      expect(result.topErrors).toEqual(topErrors);
      expect(Array.isArray(result.topErrors)).toBe(true);
    });

    it('should serialize and deserialize complex pattern objects', () => {
      const patterns = [
        {
          pattern: 'StackOverflow',
          count: 3,
          examples: ['ex1', 'ex2', 'ex3'],
        },
      ];
      const record = store.saveErrorPatterns({
        filePath: '/test.log',
        patterns,
      });

      expect(record.patterns).toEqual(patterns);
      expect(record.patterns[0].examples).toHaveLength(3);
    });
  });
});
