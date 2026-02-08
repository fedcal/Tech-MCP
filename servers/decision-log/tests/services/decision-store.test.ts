import { describe, it, expect } from 'vitest';
import { DecisionStore } from '../../src/services/decision-store.js';

describe('DecisionStore', () => {
  function createStore() {
    return new DecisionStore({ inMemory: true });
  }

  it('should record and retrieve a decision', () => {
    const store = createStore();
    const decision = store.recordDecision({
      title: 'Use PostgreSQL',
      context: 'We need a relational database for analytics',
      decision: 'Use PostgreSQL with read replicas',
      alternatives: ['MySQL', 'SQLite'],
      consequences: 'Higher operational cost but better JSON support',
      status: 'accepted',
      relatedTickets: ['PROJ-123'],
    });

    expect(decision.id).toBeDefined();
    expect(decision.title).toBe('Use PostgreSQL');
    expect(decision.status).toBe('accepted');
    expect(decision.alternatives).toEqual(['MySQL', 'SQLite']);
    expect(decision.relatedTickets).toEqual(['PROJ-123']);

    const retrieved = store.getDecision(decision.id);
    expect(retrieved).toEqual(decision);
  });

  it('should list decisions with filters', () => {
    const store = createStore();
    store.recordDecision({ title: 'ADR-1', context: 'c', decision: 'd', status: 'accepted' });
    store.recordDecision({ title: 'ADR-2', context: 'c', decision: 'd', status: 'proposed' });
    store.recordDecision({ title: 'ADR-3', context: 'c', decision: 'd', status: 'accepted' });

    const all = store.listDecisions();
    expect(all).toHaveLength(3);

    const accepted = store.listDecisions({ status: 'accepted' });
    expect(accepted).toHaveLength(2);

    const limited = store.listDecisions({ limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('should search decisions by text', () => {
    const store = createStore();
    store.recordDecision({ title: 'Use Redis for caching', context: 'Need fast cache', decision: 'Redis' });
    store.recordDecision({ title: 'Use PostgreSQL', context: 'Analytics DB', decision: 'PostgreSQL' });

    const results = store.searchDecisions('Redis');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Use Redis for caching');
  });

  it('should supersede a decision', () => {
    const store = createStore();
    const old = store.recordDecision({ title: 'Use MySQL', context: 'c', decision: 'd', status: 'accepted' });
    const replacement = store.recordDecision({ title: 'Use PostgreSQL', context: 'c', decision: 'd', status: 'accepted' });

    const updated = store.supersedeDecision(old.id, replacement.id);
    expect(updated?.status).toBe('superseded');
    expect(updated?.supersededBy).toBe(replacement.id);
  });

  it('should create and retrieve decision links', () => {
    const store = createStore();
    const decision = store.recordDecision({ title: 'ADR-1', context: 'c', decision: 'd' });

    const link = store.linkDecision({
      decisionId: decision.id,
      linkType: 'ticket',
      targetId: 'PROJ-123',
      description: 'Related ticket',
    });

    expect(link.id).toBeDefined();
    expect(link.linkType).toBe('ticket');
    expect(link.targetId).toBe('PROJ-123');

    const links = store.getDecisionLinks(decision.id);
    expect(links).toHaveLength(1);
    expect(links[0].targetId).toBe('PROJ-123');
  });

  it('should return undefined for non-existent decision', () => {
    const store = createStore();
    expect(store.getDecision(999)).toBeUndefined();
  });
});
