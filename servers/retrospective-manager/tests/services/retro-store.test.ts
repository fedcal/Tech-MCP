import { describe, it, expect, beforeEach } from 'vitest';
import { RetroStore } from '../../src/services/retro-store.js';

describe('RetroStore', () => {
  let store: RetroStore;

  beforeEach(() => {
    store = new RetroStore(true);
  });

  // ── createRetro ───────────────────────────────────────────────────────

  describe('createRetro', () => {
    it('should create a retro with mad-sad-glad format', () => {
      const result = store.createRetro('mad-sad-glad', 'sprint-1');

      expect(result.retro.id).toBeDefined();
      expect(result.retro.format).toBe('mad-sad-glad');
      expect(result.retro.sprintId).toBe('sprint-1');
      expect(result.retro.status).toBe('active');
      expect(Object.keys(result.categories)).toEqual(['mad', 'sad', 'glad']);
      expect(result.actionItems).toEqual([]);
    });

    it('should create a retro with 4ls format', () => {
      const result = store.createRetro('4ls');

      expect(result.retro.format).toBe('4ls');
      expect(Object.keys(result.categories)).toEqual(['liked', 'learned', 'lacked', 'longed-for']);
    });

    it('should create a retro with start-stop-continue format', () => {
      const result = store.createRetro('start-stop-continue');

      expect(Object.keys(result.categories)).toEqual(['start', 'stop', 'continue']);
    });
  });

  // ── addItem ───────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add an item to a retro', () => {
      const retro = store.createRetro('mad-sad-glad');

      const item = store.addItem(retro.retro.id, 'mad', 'Too many meetings');

      expect(item.id).toBeDefined();
      expect(item.retroId).toBe(retro.retro.id);
      expect(item.category).toBe('mad');
      expect(item.content).toBe('Too many meetings');
      expect(item.votes).toBe(0);
    });

    it('should throw for a non-existent retro', () => {
      expect(() => store.addItem(9999, 'mad', 'Test')).toThrow(/no retrospective found/i);
    });

    it('should throw for an invalid category', () => {
      const retro = store.createRetro('mad-sad-glad');
      expect(() =>
        store.addItem(retro.retro.id, 'invalid-category', 'Test'),
      ).toThrow(/invalid category/i);
    });

    it('should accept an optional authorId', () => {
      const retro = store.createRetro('mad-sad-glad');
      const item = store.addItem(retro.retro.id, 'glad', 'Great teamwork', 'alice');
      expect(item.authorId).toBe('alice');
    });
  });

  // ── voteItem ──────────────────────────────────────────────────────────

  describe('voteItem', () => {
    it('should increment the vote count of an item', () => {
      const retro = store.createRetro('mad-sad-glad');
      const item = store.addItem(retro.retro.id, 'sad', 'Missed deadline');

      const voted1 = store.voteItem(item.id);
      expect(voted1.votes).toBe(1);

      const voted2 = store.voteItem(item.id);
      expect(voted2.votes).toBe(2);
    });

    it('should throw for a non-existent item', () => {
      expect(() => store.voteItem(9999)).toThrow(/no retro item found/i);
    });
  });

  // ── generateActionItems ───────────────────────────────────────────────

  describe('generateActionItems', () => {
    it('should generate action items from top-voted items', () => {
      const retro = store.createRetro('mad-sad-glad');
      const item1 = store.addItem(retro.retro.id, 'mad', 'Item 1');
      const item2 = store.addItem(retro.retro.id, 'sad', 'Item 2');
      store.addItem(retro.retro.id, 'glad', 'Item 3');

      // Vote item2 higher
      store.voteItem(item2.id);
      store.voteItem(item2.id);
      store.voteItem(item1.id);

      const actions = store.generateActionItems(retro.retro.id, 2);

      expect(actions).toHaveLength(2);
      // First action should come from the highest voted item
      expect(actions[0].description).toContain('Item 2');
      expect(actions[1].description).toContain('Item 1');
      expect(actions[0].status).toBe('open');
    });

    it('should throw for a non-existent retro', () => {
      expect(() => store.generateActionItems(9999)).toThrow(/no retrospective found/i);
    });
  });

  // ── getRetro ──────────────────────────────────────────────────────────

  describe('getRetro', () => {
    it('should return full retro with items grouped by category and action items', () => {
      const created = store.createRetro('mad-sad-glad', 'sprint-5');
      store.addItem(created.retro.id, 'mad', 'Too many bugs');
      store.addItem(created.retro.id, 'glad', 'Great collaboration');
      store.generateActionItems(created.retro.id);

      const full = store.getRetro(created.retro.id);

      expect(full.retro.id).toBe(created.retro.id);
      expect(full.categories['mad']).toHaveLength(1);
      expect(full.categories['glad']).toHaveLength(1);
      expect(full.categories['sad']).toHaveLength(0);
      expect(full.actionItems.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw for a non-existent retro', () => {
      expect(() => store.getRetro(9999)).toThrow(/no retrospective found/i);
    });
  });
});
