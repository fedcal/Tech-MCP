import { describe, it, expect, beforeEach } from 'vitest';
import { RegexStore } from '../../src/services/regex-store.js';

describe('RegexStore', () => {
  let store: RegexStore;

  beforeEach(() => {
    store = new RegexStore({ inMemory: true });
  });

  // -- Saved Patterns --------------------------------------------------------

  describe('savePattern', () => {
    it('should save and return a pattern with an id', () => {
      const pattern = store.savePattern({
        name: 'email',
        pattern: '^[\\w.-]+@[\\w.-]+\\.\\w+$',
        flags: 'i',
        description: 'Matches email addresses',
      });

      expect(pattern.id).toBe(1);
      expect(pattern.name).toBe('email');
      expect(pattern.pattern).toBe('^[\\w.-]+@[\\w.-]+\\.\\w+$');
      expect(pattern.flags).toBe('i');
      expect(pattern.description).toBe('Matches email addresses');
      expect(pattern.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the testCases JSON array', () => {
      const testCases = [
        { input: 'user@example.com', expected: true },
        { input: 'invalid', expected: false },
      ];
      const pattern = store.savePattern({
        name: 'email',
        pattern: '^.+@.+$',
        flags: '',
        description: 'Email pattern',
        testCases,
      });

      expect(pattern.testCases).toEqual(testCases);
      expect(Array.isArray(pattern.testCases)).toBe(true);
    });

    it('should upsert when saving a pattern with the same name', () => {
      store.savePattern({ name: 'email', pattern: 'v1', flags: '', description: 'first' });
      const updated = store.savePattern({ name: 'email', pattern: 'v2', flags: 'g', description: 'second' });

      expect(updated.pattern).toBe('v2');
      expect(updated.flags).toBe('g');
      expect(store.listPatterns()).toHaveLength(1);
    });
  });

  describe('getPattern', () => {
    it('should return undefined for a non-existent pattern', () => {
      expect(store.getPattern('nonexistent')).toBeUndefined();
    });

    it('should retrieve a saved pattern by name', () => {
      store.savePattern({ name: 'url', pattern: 'https?://', flags: '', description: 'URL' });

      const found = store.getPattern('url');
      expect(found).toBeDefined();
      expect(found!.name).toBe('url');
    });
  });

  describe('listPatterns', () => {
    it('should return an empty array when no patterns exist', () => {
      expect(store.listPatterns()).toEqual([]);
    });

    it('should list all saved patterns', () => {
      store.savePattern({ name: 'email', pattern: '.+@.+', flags: '', description: '' });
      store.savePattern({ name: 'url', pattern: 'https?://', flags: '', description: '' });

      expect(store.listPatterns()).toHaveLength(2);
    });
  });

  describe('deletePattern', () => {
    it('should return false when deleting a non-existent pattern', () => {
      expect(store.deletePattern('nonexistent')).toBe(false);
    });

    it('should delete an existing pattern and return true', () => {
      store.savePattern({ name: 'email', pattern: '.+@.+', flags: '', description: '' });

      expect(store.deletePattern('email')).toBe(true);
      expect(store.getPattern('email')).toBeUndefined();
      expect(store.listPatterns()).toHaveLength(0);
    });
  });

  // -- Regex History ---------------------------------------------------------

  describe('logOperation', () => {
    it('should log an operation and return a history entry', () => {
      const entry = store.logOperation({
        operation: 'test',
        pattern: '^\\d+$',
        flags: 'g',
        result: { matched: true },
      });

      expect(entry.id).toBe(1);
      expect(entry.operation).toBe('test');
      expect(entry.pattern).toBe('^\\d+$');
      expect(entry.flags).toBe('g');
      expect(entry.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the result JSON field', () => {
      const result = { matches: ['123', '456'], count: 2 };
      const entry = store.logOperation({
        operation: 'match',
        pattern: '\\d+',
        flags: 'g',
        result,
      });

      expect(entry.result).toEqual(result);
    });
  });

  describe('listHistory', () => {
    it('should return an empty array when no history exists', () => {
      expect(store.listHistory()).toEqual([]);
    });

    it('should list all history entries', () => {
      store.logOperation({ operation: 'test', pattern: 'a', flags: '', result: {} });
      store.logOperation({ operation: 'match', pattern: 'b', flags: '', result: {} });

      expect(store.listHistory()).toHaveLength(2);
    });

    it('should filter history by operation', () => {
      store.logOperation({ operation: 'test', pattern: 'a', flags: '', result: {} });
      store.logOperation({ operation: 'match', pattern: 'b', flags: '', result: {} });
      store.logOperation({ operation: 'test', pattern: 'c', flags: '', result: {} });

      const filtered = store.listHistory('test');
      expect(filtered).toHaveLength(2);
      filtered.forEach((e) => expect(e.operation).toBe('test'));
    });

    it('should respect the limit parameter', () => {
      store.logOperation({ operation: 'test', pattern: 'a', flags: '', result: {} });
      store.logOperation({ operation: 'test', pattern: 'b', flags: '', result: {} });
      store.logOperation({ operation: 'test', pattern: 'c', flags: '', result: {} });

      expect(store.listHistory(undefined, 2)).toHaveLength(2);
    });
  });
});
