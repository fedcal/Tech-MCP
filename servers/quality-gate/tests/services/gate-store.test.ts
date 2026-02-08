import { describe, it, expect } from 'vitest';
import { GateStore } from '../../src/services/gate-store.js';

describe('GateStore', () => {
  function createStore() {
    return new GateStore({ inMemory: true });
  }

  it('should define and retrieve a gate', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Release Gate',
      projectName: 'my-app',
      checks: [
        { metric: 'coverage', operator: '>=', threshold: 80 },
        { metric: 'bugs', operator: '<=', threshold: 0 },
      ],
    });

    expect(gate.id).toBeDefined();
    expect(gate.name).toBe('Release Gate');
    expect(gate.projectName).toBe('my-app');
    expect(gate.checks).toHaveLength(2);
    expect(gate.checks[0].metric).toBe('coverage');

    const retrieved = store.getGate(gate.id);
    expect(retrieved).toEqual(gate);
  });

  it('should get gate by name', () => {
    const store = createStore();
    store.defineGate({
      name: 'Deploy Gate',
      checks: [{ metric: 'tests', operator: '>=', threshold: 100 }],
    });

    const gate = store.getGateByName('Deploy Gate');
    expect(gate).toBeDefined();
    expect(gate!.name).toBe('Deploy Gate');
  });

  it('should list all gates', () => {
    const store = createStore();
    store.defineGate({ name: 'Gate-1', checks: [{ metric: 'a', operator: '>=', threshold: 1 }] });
    store.defineGate({ name: 'Gate-2', checks: [{ metric: 'b', operator: '>=', threshold: 2 }] });
    store.defineGate({ name: 'Gate-3', projectName: 'proj-x', checks: [{ metric: 'c', operator: '>=', threshold: 3 }] });

    const all = store.listGates();
    expect(all).toHaveLength(3);
  });

  it('should list gates filtered by projectName', () => {
    const store = createStore();
    store.defineGate({ name: 'Gate-A', projectName: 'proj-x', checks: [{ metric: 'a', operator: '>=', threshold: 1 }] });
    store.defineGate({ name: 'Gate-B', projectName: 'proj-y', checks: [{ metric: 'b', operator: '>=', threshold: 2 }] });
    store.defineGate({ name: 'Gate-C', projectName: 'proj-x', checks: [{ metric: 'c', operator: '>=', threshold: 3 }] });

    const filtered = store.listGates({ projectName: 'proj-x' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((g) => g.projectName === 'proj-x')).toBe(true);
  });

  it('should delete a gate', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Temp Gate',
      checks: [{ metric: 'a', operator: '>=', threshold: 1 }],
    });

    expect(store.deleteGate(gate.id)).toBe(true);
    expect(store.getGate(gate.id)).toBeUndefined();
  });

  it('should return false when deleting non-existent gate', () => {
    const store = createStore();
    expect(store.deleteGate(999)).toBe(false);
  });

  it('should evaluate a gate that passes', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Pass Gate',
      checks: [
        { metric: 'coverage', operator: '>=', threshold: 80 },
        { metric: 'bugs', operator: '<=', threshold: 5 },
      ],
    });

    const evaluation = store.evaluateGate(gate.id, { coverage: 90, bugs: 2 });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toHaveLength(0);
    expect(evaluation.gateId).toBe(gate.id);
  });

  it('should evaluate a gate that fails', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Fail Gate',
      checks: [
        { metric: 'coverage', operator: '>=', threshold: 80 },
        { metric: 'bugs', operator: '<=', threshold: 0 },
      ],
    });

    const evaluation = store.evaluateGate(gate.id, { coverage: 50, bugs: 3 });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failures).toHaveLength(2);
    expect(evaluation.failures[0]).toContain('coverage');
    expect(evaluation.failures[1]).toContain('bugs');
  });

  it('should fail evaluation when metric is missing', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Missing Metric Gate',
      checks: [
        { metric: 'coverage', operator: '>=', threshold: 80 },
      ],
    });

    const evaluation = store.evaluateGate(gate.id, {});
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failures).toHaveLength(1);
    expect(evaluation.failures[0]).toContain('missing');
  });

  it('should throw when evaluating non-existent gate', () => {
    const store = createStore();
    expect(() => store.evaluateGate(999, { coverage: 80 })).toThrow('Gate 999 not found');
  });

  it('should get evaluation history', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'History Gate',
      checks: [{ metric: 'coverage', operator: '>=', threshold: 80 }],
    });

    store.evaluateGate(gate.id, { coverage: 90 });
    store.evaluateGate(gate.id, { coverage: 70 });
    store.evaluateGate(gate.id, { coverage: 85 });

    const history = store.getEvaluationHistory(gate.id);
    expect(history).toHaveLength(3);
  });

  it('should limit evaluation history', () => {
    const store = createStore();
    const gate = store.defineGate({
      name: 'Limit Gate',
      checks: [{ metric: 'coverage', operator: '>=', threshold: 80 }],
    });

    store.evaluateGate(gate.id, { coverage: 90 });
    store.evaluateGate(gate.id, { coverage: 70 });
    store.evaluateGate(gate.id, { coverage: 85 });

    const history = store.getEvaluationHistory(gate.id, 2);
    expect(history).toHaveLength(2);
  });

  it('should return undefined for non-existent gate', () => {
    const store = createStore();
    expect(store.getGate(999)).toBeUndefined();
  });
});
