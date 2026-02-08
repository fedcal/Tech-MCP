import { describe, it, expect, beforeEach } from 'vitest';
import { ExplorerStore } from '../../src/services/explorer-store.js';

describe('ExplorerStore', () => {
  let store: ExplorerStore;

  beforeEach(() => {
    store = new ExplorerStore({ inMemory: true });
  });

  // ---------- Explorations ----------

  describe('saveExploration', () => {
    it('should save an exploration and return it with an id', () => {
      const schema = [
        { name: 'users', columns: ['id', 'name', 'email'] },
        { name: 'posts', columns: ['id', 'title', 'body'] },
      ];
      const exploration = store.saveExploration({
        dbPath: '/data/app.db',
        tableCount: 2,
        schema,
      });

      expect(exploration.id).toBe(1);
      expect(exploration.dbPath).toBe('/data/app.db');
      expect(exploration.tableCount).toBe(2);
      expect(exploration.schema).toEqual(schema);
      expect(exploration.exploredAt).toBeDefined();
    });

    it('should auto-increment ids', () => {
      const e1 = store.saveExploration({ dbPath: '/a.db', tableCount: 1, schema: [] });
      const e2 = store.saveExploration({ dbPath: '/b.db', tableCount: 2, schema: [] });

      expect(e2.id).toBe(e1.id + 1);
    });
  });

  describe('getLatestExploration', () => {
    it('should return an exploration for the given dbPath', () => {
      const saved = store.saveExploration({
        dbPath: '/app.db',
        tableCount: 2,
        schema: [{ name: 'users' }, { name: 'posts' }],
      });
      store.saveExploration({
        dbPath: '/other.db',
        tableCount: 5,
        schema: [],
      });

      const latest = store.getLatestExploration('/app.db');
      expect(latest).toBeDefined();
      expect(latest!.id).toBe(saved.id);
      expect(latest!.dbPath).toBe('/app.db');
      expect(latest!.tableCount).toBe(2);
      expect(latest!.schema).toHaveLength(2);
    });

    it('should return undefined when no exploration exists for path', () => {
      expect(store.getLatestExploration('/nonexistent.db')).toBeUndefined();
    });
  });

  describe('listExplorations', () => {
    it('should return an empty array when no explorations exist', () => {
      expect(store.listExplorations()).toEqual([]);
    });

    it('should return all explorations', () => {
      store.saveExploration({ dbPath: '/a.db', tableCount: 1, schema: [] });
      store.saveExploration({ dbPath: '/b.db', tableCount: 2, schema: [] });

      expect(store.listExplorations()).toHaveLength(2);
    });
  });

  // ---------- Index Suggestions ----------

  describe('saveIndexSuggestion', () => {
    it('should save an index suggestion and return it', () => {
      const suggestion = store.saveIndexSuggestion({
        dbPath: '/app.db',
        tableName: 'users',
        columns: ['email', 'created_at'],
        reason: 'Frequent lookups by email with date filter',
      });

      expect(suggestion.id).toBe(1);
      expect(suggestion.dbPath).toBe('/app.db');
      expect(suggestion.tableName).toBe('users');
      expect(suggestion.columns).toEqual(['email', 'created_at']);
      expect(suggestion.reason).toBe('Frequent lookups by email with date filter');
      expect(suggestion.createdAt).toBeDefined();
    });
  });

  describe('listSuggestions', () => {
    it('should return an empty array when no suggestions exist', () => {
      expect(store.listSuggestions()).toEqual([]);
    });

    it('should filter by dbPath when provided', () => {
      store.saveIndexSuggestion({
        dbPath: '/a.db',
        tableName: 'users',
        columns: ['id'],
        reason: 'PK lookup',
      });
      store.saveIndexSuggestion({
        dbPath: '/b.db',
        tableName: 'posts',
        columns: ['author_id'],
        reason: 'FK join',
      });

      const filtered = store.listSuggestions('/a.db');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].dbPath).toBe('/a.db');
    });

    it('should return all suggestions when no filter is given', () => {
      store.saveIndexSuggestion({
        dbPath: '/a.db',
        tableName: 't1',
        columns: ['c1'],
        reason: 'r1',
      });
      store.saveIndexSuggestion({
        dbPath: '/b.db',
        tableName: 't2',
        columns: ['c2'],
        reason: 'r2',
      });

      expect(store.listSuggestions()).toHaveLength(2);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should serialize and deserialize schema as JSON array', () => {
      const schema = [
        { name: 'users', columns: ['id', 'name'], rowCount: 100 },
        { name: 'orders', columns: ['id', 'user_id', 'total'], rowCount: 500 },
      ];
      const exploration = store.saveExploration({
        dbPath: '/test.db',
        tableCount: 2,
        schema,
      });

      expect(exploration.schema).toEqual(schema);
      expect(Array.isArray(exploration.schema)).toBe(true);
    });

    it('should serialize and deserialize columns as JSON string array', () => {
      const columns = ['user_id', 'status', 'created_at'];
      const suggestion = store.saveIndexSuggestion({
        dbPath: '/test.db',
        tableName: 'orders',
        columns,
        reason: 'composite index for filtering',
      });

      expect(suggestion.columns).toEqual(columns);
      expect(Array.isArray(suggestion.columns)).toBe(true);
    });
  });
});
