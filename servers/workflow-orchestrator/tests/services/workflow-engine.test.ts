import { describe, it, expect } from 'vitest';
import { WorkflowStore } from '../../src/services/workflow-store.js';
import { WorkflowEngine } from '../../src/services/workflow-engine.js';

describe('WorkflowEngine', () => {
  function createEngine() {
    const store = new WorkflowStore({ inMemory: true });
    const engine = new WorkflowEngine(store);
    return { store, engine };
  }

  it('should resolve simple {{payload.field}} templates', () => {
    const { engine } = createEngine();
    const result = engine.resolveTemplates(
      { name: '{{payload.name}}', event: '{{payload.event}}' },
      { payload: { name: 'Test', event: 'deploy' }, steps: [] },
    );

    expect(result.name).toBe('Test');
    expect(result.event).toBe('deploy');
  });

  it('should resolve {{steps[0].result.field}} templates', () => {
    const { engine } = createEngine();
    const result = engine.resolveTemplates(
      { prevId: '{{steps[0].result.id}}', prevName: '{{steps[1].result.name}}' },
      {
        payload: {},
        steps: [
          { result: { id: 42, name: 'first' } },
          { result: { id: 99, name: 'second' } },
        ],
      },
    );

    expect(result.prevId).toBe(42);
    expect(result.prevName).toBe('second');
  });

  it('should resolve nested {{payload.data.id}} templates', () => {
    const { engine } = createEngine();
    const result = engine.resolveTemplates(
      { deepValue: '{{payload.data.nested.id}}' },
      { payload: { data: { nested: { id: 'abc-123' } } }, steps: [] },
    );

    expect(result.deepValue).toBe('abc-123');
  });

  it('should handle mixed text "Sprint {{payload.name}}" as string interpolation', () => {
    const { engine } = createEngine();
    const result = engine.resolveTemplates(
      { label: 'Sprint {{payload.name}} completed' },
      { payload: { name: 'Test Sprint' }, steps: [] },
    );

    expect(result.label).toBe('Sprint Test Sprint completed');
  });

  it('should preserve original type for full-template (number stays number)', () => {
    const { engine } = createEngine();
    const result = engine.resolveTemplates(
      { count: '{{payload.count}}', active: '{{payload.active}}' },
      { payload: { count: 42, active: true }, steps: [] },
    );

    expect(result.count).toBe(42);
    expect(typeof result.count).toBe('number');
    expect(result.active).toBe(true);
    expect(typeof result.active).toBe('boolean');
  });

  it('should evaluate trigger conditions correctly', () => {
    const { engine } = createEngine();

    // Match
    expect(
      engine.evaluateTrigger(
        { status: 'completed', branch: 'main' },
        { status: 'completed', branch: 'main', extra: 'ignored' },
      ),
    ).toBe(true);

    // Reject: mismatched value
    expect(
      engine.evaluateTrigger(
        { status: 'completed' },
        { status: 'failed' },
      ),
    ).toBe(false);

    // Reject: missing key in payload
    expect(
      engine.evaluateTrigger(
        { status: 'completed' },
        { branch: 'main' },
      ),
    ).toBe(false);

    // Empty conditions always match
    expect(
      engine.evaluateTrigger({}, { anything: 'goes' }),
    ).toBe(true);
  });
});
