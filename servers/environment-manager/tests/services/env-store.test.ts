import { describe, it, expect, beforeEach } from 'vitest';
import { EnvStore } from '../../src/services/env-store.js';

describe('EnvStore', () => {
  let store: EnvStore;

  beforeEach(() => {
    store = new EnvStore({ inMemory: true });
  });

  // -- Snapshots -------------------------------------------------------------

  describe('saveSnapshot', () => {
    it('should save and return an env snapshot with an id', () => {
      const snapshot = store.saveSnapshot({
        envName: 'production',
        filePath: '/app/.env.production',
        variableCount: 15,
        variables: [{ key: 'DB_HOST', value: 'db.example.com' }],
      });

      expect(snapshot.id).toBe(1);
      expect(snapshot.envName).toBe('production');
      expect(snapshot.filePath).toBe('/app/.env.production');
      expect(snapshot.variableCount).toBe(15);
      expect(snapshot.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the variables JSON array', () => {
      const variables = [
        { key: 'DB_HOST', value: 'localhost' },
        { key: 'DB_PORT', value: '5432' },
        { key: 'NODE_ENV', value: 'production' },
      ];
      const snapshot = store.saveSnapshot({
        envName: 'production',
        filePath: '/app/.env',
        variableCount: 3,
        variables,
      });

      expect(snapshot.variables).toEqual(variables);
      expect(Array.isArray(snapshot.variables)).toBe(true);
      expect(snapshot.variables).toHaveLength(3);
    });
  });

  describe('listSnapshots', () => {
    it('should return an empty array when no snapshots exist', () => {
      expect(store.listSnapshots()).toEqual([]);
    });

    it('should list all snapshots', () => {
      store.saveSnapshot({ envName: 'dev', filePath: '.env.dev', variableCount: 5, variables: [] });
      store.saveSnapshot({ envName: 'prod', filePath: '.env.prod', variableCount: 10, variables: [] });

      expect(store.listSnapshots()).toHaveLength(2);
    });

    it('should filter snapshots by envName', () => {
      store.saveSnapshot({ envName: 'dev', filePath: '.env.dev', variableCount: 5, variables: [] });
      store.saveSnapshot({ envName: 'prod', filePath: '.env.prod', variableCount: 10, variables: [] });
      store.saveSnapshot({ envName: 'dev', filePath: '.env.dev', variableCount: 6, variables: [] });

      const filtered = store.listSnapshots('dev');
      expect(filtered).toHaveLength(2);
      filtered.forEach((s) => expect(s.envName).toBe('dev'));
    });
  });

  // -- Comparisons -----------------------------------------------------------

  describe('saveComparison', () => {
    it('should save and return an env comparison with an id', () => {
      const comparison = store.saveComparison({
        envA: 'dev',
        envB: 'prod',
        differences: { missing_in_prod: ['DEBUG'] },
      });

      expect(comparison.id).toBe(1);
      expect(comparison.envA).toBe('dev');
      expect(comparison.envB).toBe('prod');
      expect(comparison.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the differences JSON field', () => {
      const differences = {
        missing_in_a: ['SECRET_KEY'],
        missing_in_b: ['DEBUG'],
        different_values: [{ key: 'LOG_LEVEL', a: 'debug', b: 'error' }],
      };
      const comparison = store.saveComparison({
        envA: 'staging',
        envB: 'production',
        differences,
      });

      expect(comparison.differences).toEqual(differences);
      expect(typeof comparison.differences).toBe('object');
    });
  });

  describe('listComparisons', () => {
    it('should return an empty array when no comparisons exist', () => {
      expect(store.listComparisons()).toEqual([]);
    });

    it('should list all comparisons', () => {
      store.saveComparison({ envA: 'dev', envB: 'staging', differences: {} });
      store.saveComparison({ envA: 'staging', envB: 'prod', differences: {} });

      expect(store.listComparisons()).toHaveLength(2);
    });
  });
});
