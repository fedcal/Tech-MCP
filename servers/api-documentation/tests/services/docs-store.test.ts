import { describe, it, expect, beforeEach } from 'vitest';
import { DocsStore } from '../../src/services/docs-store.js';

describe('DocsStore', () => {
  let store: DocsStore;

  beforeEach(() => {
    store = new DocsStore({ inMemory: true });
  });

  // -- API Specs -------------------------------------------------------------

  describe('saveSpec', () => {
    it('should save and return an API spec with an id', () => {
      const spec = store.saveSpec({
        title: 'User API',
        version: '1.0.0',
        endpointCount: 12,
        spec: { openapi: '3.0.0' },
      });

      expect(spec.id).toBe(1);
      expect(spec.title).toBe('User API');
      expect(spec.version).toBe('1.0.0');
      expect(spec.endpointCount).toBe(12);
      expect(spec.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the spec JSON field', () => {
      const specData = {
        openapi: '3.0.0',
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const record = store.saveSpec({
        title: 'User API',
        version: '2.0.0',
        endpointCount: 5,
        spec: specData,
      });

      expect(record.spec).toEqual(specData);
      expect(typeof record.spec).toBe('object');
    });
  });

  describe('listSpecs', () => {
    it('should return an empty array when no specs exist', () => {
      expect(store.listSpecs()).toEqual([]);
    });

    it('should list all saved specs', () => {
      store.saveSpec({ title: 'API A', version: '1.0', endpointCount: 3, spec: {} });
      store.saveSpec({ title: 'API B', version: '2.0', endpointCount: 7, spec: {} });

      const list = store.listSpecs();
      expect(list).toHaveLength(2);
    });
  });

  // -- Documentation Issues --------------------------------------------------

  describe('saveIssue', () => {
    it('should save and return a documentation issue', () => {
      const issue = store.saveIssue({
        filePath: '/docs/api.md',
        issueType: 'missing-description',
        details: 'Endpoint GET /users lacks a description',
      });

      expect(issue.id).toBe(1);
      expect(issue.filePath).toBe('/docs/api.md');
      expect(issue.issueType).toBe('missing-description');
      expect(issue.details).toBe('Endpoint GET /users lacks a description');
      expect(issue.createdAt).toBeDefined();
    });
  });

  describe('listIssues', () => {
    it('should return an empty array when no issues exist', () => {
      expect(store.listIssues()).toEqual([]);
    });

    it('should list all documentation issues', () => {
      store.saveIssue({ filePath: 'a.md', issueType: 'typo', details: 'typo found' });
      store.saveIssue({ filePath: 'b.md', issueType: 'outdated', details: 'old info' });
      store.saveIssue({ filePath: 'c.md', issueType: 'missing', details: 'no examples' });

      const list = store.listIssues();
      expect(list).toHaveLength(3);
    });
  });
});
