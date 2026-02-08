import { describe, it, expect } from 'vitest';
import { DashboardStore } from '../../src/services/dashboard-store.js';

describe('DashboardStore', () => {
  function createStore() {
    return new DashboardStore({ inMemory: true });
  }

  it('should cache and retrieve data', () => {
    const store = createStore();
    const data = { velocity: 42, trend: 'improving' };
    store.setCache('overview', 'main', data, 120);

    const cached = store.getCached('overview', 'main');
    expect(cached).toBeDefined();
    expect(cached).toEqual(data);
  });

  it('should return undefined for expired cache', () => {
    const store = createStore();
    const data = { test: true };
    // Set cache with 0 TTL so it expires immediately
    store.setCache('overview', 'expired', data, 0);

    const cached = store.getCached('overview', 'expired');
    expect(cached).toBeUndefined();
  });

  it('should invalidate entries by type and clean expired returns zero for non-expired', () => {
    const store = createStore();
    store.setCache('overview', 'a', { a: 1 }, 3600);
    store.setCache('overview', 'b', { b: 2 }, 3600);
    store.setCache('activity', 'valid', { c: 3 }, 3600);

    // Invalidate by type removes all of that type
    const invalidated = store.invalidate('overview');
    expect(invalidated).toBe(2);

    // cleanExpired should return 0 since remaining entry is still valid
    const cleaned = store.cleanExpired();
    expect(cleaned).toBe(0);

    const stats = store.getCacheStats();
    expect(stats.total).toBe(1);
    expect(stats.byType).toEqual({ activity: 1 });
  });

  it('should return correct cache stats', () => {
    const store = createStore();
    store.setCache('overview', 'main', { a: 1 }, 3600);
    store.setCache('activity', 'limit-20', { b: 2 }, 3600);
    store.setCache('activity', 'limit-10', { c: 3 }, 3600);

    const stats = store.getCacheStats();
    expect(stats.total).toBe(3);
    expect(stats.byType).toEqual({
      overview: 1,
      activity: 2,
    });
  });
});
