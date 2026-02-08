import { describe, it, expect } from 'vitest';
import { InsightStore } from '../../src/services/insight-store.js';

describe('InsightStore', () => {
  function createStore() {
    return new InsightStore({ inMemory: true });
  }

  it('should cache and retrieve analysis', () => {
    const store = createStore();
    const result = { score: 85, details: 'all good' };
    store.cacheAnalysis('insight', 'test-question', result, 300);

    const cached = store.getCachedAnalysis('insight', 'test-question');
    expect(cached).toBeDefined();
    expect(JSON.parse(cached!.result)).toEqual(result);
    expect(cached!.analysisType).toBe('insight');
    expect(cached!.queryKey).toBe('test-question');
  });

  it('should return undefined for expired cache', () => {
    const store = createStore();
    const result = { score: 50 };
    // Cache with TTL 0 seconds - should expire immediately
    store.cacheAnalysis('insight', 'expired-q', result, 0);

    const cached = store.getCachedAnalysis('insight', 'expired-q');
    // TTL 0 means expiresAt = datetime('now', '+0 seconds') = datetime('now')
    // The query uses expiresAt > datetime('now'), so it should NOT be returned
    expect(cached).toBeUndefined();
  });

  it('should clean expired entries', () => {
    const store = createStore();
    // Insert with TTL 0 (expires immediately)
    store.cacheAnalysis('insight', 'q1', { a: 1 }, 0);
    store.cacheAnalysis('insight', 'q2', { a: 2 }, 0);
    // Insert one valid
    store.cacheAnalysis('insight', 'q3', { a: 3 }, 3600);

    const cleaned = store.cleanExpired();
    // The 0-TTL entries should be cleaned; only q3 should remain
    expect(cleaned).toBeGreaterThanOrEqual(2);

    const remaining = store.listCachedAnalyses();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].queryKey).toBe('q3');
  });

  it('should invalidate by type', () => {
    const store = createStore();
    store.cacheAnalysis('insight', 'q1', { a: 1 }, 3600);
    store.cacheAnalysis('health', 'dashboard', { b: 2 }, 3600);
    store.cacheAnalysis('insight', 'q2', { c: 3 }, 3600);

    const invalidated = store.invalidateCache('insight');
    expect(invalidated).toBe(2);

    const remaining = store.listCachedAnalyses();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].analysisType).toBe('health');
  });

  it('should list cached analyses filtered by type', () => {
    const store = createStore();
    store.cacheAnalysis('insight', 'q1', { a: 1 }, 3600);
    store.cacheAnalysis('health', 'dashboard', { b: 2 }, 3600);
    store.cacheAnalysis('insight', 'q2', { c: 3 }, 3600);

    const all = store.listCachedAnalyses();
    expect(all).toHaveLength(3);

    const insightOnly = store.listCachedAnalyses('insight');
    expect(insightOnly).toHaveLength(2);
    expect(insightOnly.every((r) => r.analysisType === 'insight')).toBe(true);
  });
});
