import { describe, it, expect, beforeEach } from 'vitest';
import { SnippetStore } from '../../src/services/snippet-store.js';

describe('SnippetStore', () => {
  let store: SnippetStore;

  beforeEach(() => {
    store = new SnippetStore({ inMemory: true });
  });

  // ── save / getById ────────────────────────────────────────────────────

  describe('save / getById', () => {
    it('should save a snippet and retrieve it by id', () => {
      const snippet = store.save({
        title: 'Hello World',
        code: 'console.log("Hello");',
        language: 'typescript',
        description: 'A simple hello world',
        tags: ['demo', 'hello'],
      });

      expect(snippet.id).toBeDefined();
      expect(snippet.title).toBe('Hello World');
      expect(snippet.language).toBe('typescript');
      expect(snippet.tags).toEqual(['demo', 'hello']);

      const fetched = store.getById(snippet.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe('Hello World');
      expect(fetched!.tags).toEqual(['demo', 'hello']);
    });

    it('should return null for a non-existent snippet', () => {
      expect(store.getById('9999')).toBeNull();
    });

    it('should default tags to empty array when not provided', () => {
      const snippet = store.save({
        title: 'No Tags',
        code: 'x = 1',
        language: 'python',
      });

      expect(snippet.tags).toEqual([]);
    });
  });

  // ── search ────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should search by keyword in title', () => {
      store.save({ title: 'React Hook', code: 'useEffect(...)', language: 'typescript', tags: ['react'] });
      store.save({ title: 'Python Decorator', code: '@decorator', language: 'python', tags: ['python'] });

      const results = store.search({ keyword: 'React' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React Hook');
    });

    it('should search by language', () => {
      store.save({ title: 'TS Snippet', code: 'const x: number = 1;', language: 'typescript' });
      store.save({ title: 'PY Snippet', code: 'x = 1', language: 'python' });

      const results = store.search({ language: 'python' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('PY Snippet');
    });

    it('should search by tag', () => {
      store.save({ title: 'Snippet A', code: 'a', language: 'js', tags: ['util', 'helper'] });
      store.save({ title: 'Snippet B', code: 'b', language: 'js', tags: ['component'] });

      const results = store.search({ tag: 'util' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Snippet A');
    });

    it('should return all snippets when no filters provided', () => {
      store.save({ title: 'A', code: 'a', language: 'js' });
      store.save({ title: 'B', code: 'b', language: 'ts' });

      const results = store.search({});
      expect(results).toHaveLength(2);
    });
  });

  // ── deleteById ────────────────────────────────────────────────────────

  describe('deleteById', () => {
    it('should delete an existing snippet', () => {
      const snippet = store.save({ title: 'To Delete', code: 'x', language: 'js' });

      const deleted = store.deleteById(snippet.id);
      expect(deleted).toBe(true);

      expect(store.getById(snippet.id)).toBeNull();
    });

    it('should return false for a non-existent snippet', () => {
      expect(store.deleteById('9999')).toBe(false);
    });
  });

  // ── listTags ──────────────────────────────────────────────────────────

  describe('listTags', () => {
    it('should aggregate tags across all snippets sorted by count DESC', () => {
      store.save({ title: 'A', code: 'a', language: 'js', tags: ['react', 'hooks'] });
      store.save({ title: 'B', code: 'b', language: 'js', tags: ['react', 'state'] });
      store.save({ title: 'C', code: 'c', language: 'js', tags: ['hooks'] });

      const tags = store.listTags();

      expect(tags).toEqual([
        { tag: 'react', count: 2 },
        { tag: 'hooks', count: 2 },
        { tag: 'state', count: 1 },
      ]);
    });

    it('should return empty array when no snippets exist', () => {
      expect(store.listTags()).toEqual([]);
    });
  });

  // ── JSON Serialization ────────────────────────────────────────────────

  describe('JSON serialization of tags', () => {
    it('should correctly serialize and deserialize tags array', () => {
      const snippet = store.save({
        title: 'Tagged',
        code: 'code',
        language: 'go',
        tags: ['alpha', 'beta', 'gamma'],
      });

      const fetched = store.getById(snippet.id)!;
      expect(Array.isArray(fetched.tags)).toBe(true);
      expect(fetched.tags).toEqual(['alpha', 'beta', 'gamma']);
    });
  });
});
