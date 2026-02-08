import { describe, it, expect, beforeEach } from 'vitest';
import { HttpStore } from '../../src/services/http-store.js';

describe('HttpStore', () => {
  let store: HttpStore;

  beforeEach(() => {
    store = new HttpStore({ inMemory: true });
  });

  // ---------- Request History ----------

  describe('logRequest', () => {
    it('should log a request and return it with an id', () => {
      const entry = store.logRequest({
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { Authorization: 'Bearer token' },
        statusCode: 200,
        statusText: 'OK',
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: '{"users":[]}',
        durationMs: 150,
      });

      expect(entry.id).toBe(1);
      expect(entry.method).toBe('GET');
      expect(entry.url).toBe('https://api.example.com/users');
      expect(entry.headers).toEqual({ Authorization: 'Bearer token' });
      expect(entry.statusCode).toBe(200);
      expect(entry.responseHeaders).toEqual({ 'content-type': 'application/json' });
      expect(entry.durationMs).toBe(150);
      expect(entry.createdAt).toBeDefined();
    });

    it('should handle null optional fields', () => {
      const entry = store.logRequest({
        method: 'POST',
        url: 'https://api.example.com/data',
      });

      expect(entry.headers).toBeNull();
      expect(entry.body).toBeNull();
      expect(entry.statusCode).toBeNull();
      expect(entry.statusText).toBeNull();
      expect(entry.responseHeaders).toBeNull();
      expect(entry.responseBody).toBeNull();
      expect(entry.durationMs).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('should return an empty array when no history exists', () => {
      expect(store.listHistory()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.logRequest({ method: 'GET', url: `https://example.com/${i}` });
      }

      const limited = store.listHistory(3);
      expect(limited).toHaveLength(3);
    });

    it('should filter by url pattern', () => {
      store.logRequest({ method: 'GET', url: 'https://api.example.com/users' });
      store.logRequest({ method: 'GET', url: 'https://api.example.com/posts' });
      store.logRequest({ method: 'GET', url: 'https://other.com/data' });

      const filtered = store.listHistory(undefined, 'api.example.com');
      expect(filtered).toHaveLength(2);
    });
  });

  // ---------- Saved Requests ----------

  describe('saveRequest', () => {
    it('should save a named request and return it', () => {
      const saved = store.saveRequest({
        name: 'Get Users',
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { Accept: 'application/json' },
      });

      expect(saved.id).toBe(1);
      expect(saved.name).toBe('Get Users');
      expect(saved.method).toBe('GET');
      expect(saved.headers).toEqual({ Accept: 'application/json' });
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
    });

    it('should update an existing saved request with the same name', () => {
      store.saveRequest({
        name: 'My Request',
        method: 'GET',
        url: 'https://old.example.com',
      });

      const updated = store.saveRequest({
        name: 'My Request',
        method: 'POST',
        url: 'https://new.example.com',
      });

      expect(updated.method).toBe('POST');
      expect(updated.url).toBe('https://new.example.com');

      const all = store.listSavedRequests();
      expect(all).toHaveLength(1);
    });
  });

  describe('getSavedRequest', () => {
    it('should retrieve a saved request by name', () => {
      store.saveRequest({
        name: 'Health Check',
        method: 'GET',
        url: 'https://api.example.com/health',
      });

      const found = store.getSavedRequest('Health Check');
      expect(found).toBeDefined();
      expect(found!.url).toBe('https://api.example.com/health');
    });

    it('should return undefined for non-existent name', () => {
      expect(store.getSavedRequest('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteSavedRequest', () => {
    it('should delete an existing saved request and return true', () => {
      store.saveRequest({
        name: 'To Delete',
        method: 'GET',
        url: 'https://example.com',
      });

      const deleted = store.deleteSavedRequest('To Delete');
      expect(deleted).toBe(true);
      expect(store.getSavedRequest('To Delete')).toBeUndefined();
    });

    it('should return false when deleting a non-existent request', () => {
      const deleted = store.deleteSavedRequest('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('listSavedRequests', () => {
    it('should return an empty array when no saved requests exist', () => {
      expect(store.listSavedRequests()).toEqual([]);
    });
  });

  // ---------- JSON serialization ----------

  describe('JSON serialization', () => {
    it('should deserialize headers from JSON in request history', () => {
      const hdrs = { 'Content-Type': 'application/json', 'X-Custom': 'value' };
      const entry = store.logRequest({
        method: 'POST',
        url: 'https://example.com',
        headers: hdrs,
        responseHeaders: { 'x-req-id': 'abc123' },
      });

      expect(entry.headers).toEqual(hdrs);
      expect(entry.responseHeaders).toEqual({ 'x-req-id': 'abc123' });
    });

    it('should deserialize headers from JSON in saved requests', () => {
      const hdrs = { Authorization: 'Bearer xyz' };
      const saved = store.saveRequest({
        name: 'Auth Request',
        method: 'GET',
        url: 'https://example.com/secure',
        headers: hdrs,
      });

      expect(saved.headers).toEqual(hdrs);
    });
  });
});
