import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeStore } from '../../src/services/knowledge-store.js';

describe('KnowledgeStore', () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = new KnowledgeStore({ inMemory: true });
  });

  // -- Search History --------------------------------------------------------

  describe('saveSearch', () => {
    it('should save and return a search record with an id', () => {
      const record = store.saveSearch({
        query: 'handleAuth',
        directory: '/src',
        matchCount: 5,
        results: [{ file: 'auth.ts', line: 42 }],
      });

      expect(record.id).toBe(1);
      expect(record.query).toBe('handleAuth');
      expect(record.directory).toBe('/src');
      expect(record.matchCount).toBe(5);
      expect(record.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the results JSON field', () => {
      const results = [
        { file: 'auth.ts', line: 42, snippet: 'function handleAuth()' },
        { file: 'login.ts', line: 10, snippet: 'import { handleAuth }' },
      ];
      const record = store.saveSearch({
        query: 'handleAuth',
        directory: '/src',
        matchCount: 2,
        results,
      });

      expect(record.results).toEqual(results);
      expect(Array.isArray(record.results)).toBe(true);
    });
  });

  describe('listSearches', () => {
    it('should return an empty array when no searches exist', () => {
      expect(store.listSearches()).toEqual([]);
    });

    it('should list all search records', () => {
      store.saveSearch({ query: 'a', directory: '/src', matchCount: 1, results: [] });
      store.saveSearch({ query: 'b', directory: '/lib', matchCount: 3, results: [] });

      expect(store.listSearches()).toHaveLength(2);
    });

    it('should respect the limit parameter', () => {
      store.saveSearch({ query: 'a', directory: '/src', matchCount: 1, results: [] });
      store.saveSearch({ query: 'b', directory: '/src', matchCount: 2, results: [] });
      store.saveSearch({ query: 'c', directory: '/src', matchCount: 3, results: [] });

      const limited = store.listSearches(2);
      expect(limited).toHaveLength(2);
    });
  });

  // -- Module Explanations ---------------------------------------------------

  describe('saveExplanation', () => {
    it('should save and return a module explanation', () => {
      const record = store.saveExplanation({
        modulePath: '/src/auth/index.ts',
        explanation: 'Handles authentication and session management',
      });

      expect(record.id).toBe(1);
      expect(record.modulePath).toBe('/src/auth/index.ts');
      expect(record.explanation).toBe('Handles authentication and session management');
      expect(record.createdAt).toBeDefined();
    });
  });

  describe('getExplanation', () => {
    it('should return undefined for a non-existent module', () => {
      expect(store.getExplanation('/nonexistent')).toBeUndefined();
    });

    it('should retrieve an explanation for a given module path', () => {
      store.saveExplanation({ modulePath: '/src/auth/index.ts', explanation: 'Auth module explanation' });
      store.saveExplanation({ modulePath: '/src/utils/index.ts', explanation: 'Utils module explanation' });

      const result = store.getExplanation('/src/auth/index.ts');
      expect(result).toBeDefined();
      expect(result!.modulePath).toBe('/src/auth/index.ts');
      expect(result!.explanation).toBe('Auth module explanation');
    });
  });
});
