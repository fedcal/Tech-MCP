import { describe, it, expect } from 'vitest';
import { WorkflowStore } from '../../src/services/workflow-store.js';

describe('WorkflowStore', () => {
  function createStore() {
    return new WorkflowStore({ inMemory: true });
  }

  it('should create and retrieve a workflow', () => {
    const store = createStore();
    const workflow = store.createWorkflow({
      name: 'Sprint Completion',
      description: 'Run metrics when sprint completes',
      triggerEvent: 'scrum:sprint-completed',
      triggerConditions: { velocity: 20 },
      steps: [
        { server: 'agile-metrics', tool: 'calculate-velocity', arguments: { sprintId: '{{payload.sprintId}}' } },
      ],
    });

    expect(workflow.id).toBeDefined();
    expect(workflow.name).toBe('Sprint Completion');
    expect(workflow.description).toBe('Run metrics when sprint completes');
    expect(workflow.triggerEvent).toBe('scrum:sprint-completed');
    expect(workflow.triggerConditions).toEqual({ velocity: 20 });
    expect(workflow.steps).toHaveLength(1);
    expect(workflow.active).toBe(true);

    const retrieved = store.getWorkflow(workflow.id);
    expect(retrieved).toEqual(workflow);
  });

  it('should list workflows with active filter', () => {
    const store = createStore();
    store.createWorkflow({ name: 'W1', triggerEvent: 'e1', steps: [] });
    store.createWorkflow({ name: 'W2', triggerEvent: 'e2', steps: [] });
    const w3 = store.createWorkflow({ name: 'W3', triggerEvent: 'e3', steps: [] });
    store.toggleWorkflow(w3.id, false);

    const all = store.listWorkflows();
    expect(all).toHaveLength(3);

    const activeOnly = store.listWorkflows({ active: true });
    expect(activeOnly).toHaveLength(2);

    const inactiveOnly = store.listWorkflows({ active: false });
    expect(inactiveOnly).toHaveLength(1);
    expect(inactiveOnly[0].name).toBe('W3');
  });

  it('should toggle workflow active status', () => {
    const store = createStore();
    const workflow = store.createWorkflow({ name: 'Toggle Test', triggerEvent: 'e1', steps: [] });
    expect(workflow.active).toBe(true);

    const deactivated = store.toggleWorkflow(workflow.id, false);
    expect(deactivated?.active).toBe(false);

    const reactivated = store.toggleWorkflow(workflow.id, true);
    expect(reactivated?.active).toBe(true);
  });

  it('should get active workflows by trigger event', () => {
    const store = createStore();
    store.createWorkflow({ name: 'W1', triggerEvent: 'scrum:sprint-completed', steps: [] });
    store.createWorkflow({ name: 'W2', triggerEvent: 'scrum:sprint-completed', steps: [] });
    store.createWorkflow({ name: 'W3', triggerEvent: 'time:entry-logged', steps: [] });
    const w4 = store.createWorkflow({ name: 'W4', triggerEvent: 'scrum:sprint-completed', steps: [] });
    store.toggleWorkflow(w4.id, false);

    const matches = store.getActiveWorkflowsByTrigger('scrum:sprint-completed');
    expect(matches).toHaveLength(2);
    expect(matches.every((w) => w.triggerEvent === 'scrum:sprint-completed')).toBe(true);
  });

  it('should create a run and retrieve it', () => {
    const store = createStore();
    const workflow = store.createWorkflow({ name: 'W1', triggerEvent: 'e1', steps: [] });
    const run = store.createRun(workflow.id, { key: 'value' });

    expect(run.id).toBeDefined();
    expect(run.workflowId).toBe(workflow.id);
    expect(run.status).toBe('running');
    expect(run.triggerPayload).toEqual({ key: 'value' });

    const retrieved = store.getRun(run.id);
    expect(retrieved).toEqual(run);
  });

  it('should create steps and retrieve ordered by stepIndex', () => {
    const store = createStore();
    const workflow = store.createWorkflow({ name: 'W1', triggerEvent: 'e1', steps: [] });
    const run = store.createRun(workflow.id, {});

    store.createStep(run.id, 2, 'server-b', 'tool-b', { b: 1 });
    store.createStep(run.id, 0, 'server-a', 'tool-a', { a: 1 });
    store.createStep(run.id, 1, 'server-c', 'tool-c', { c: 1 });

    const steps = store.getStepsForRun(run.id);
    expect(steps).toHaveLength(3);
    expect(steps[0].stepIndex).toBe(0);
    expect(steps[1].stepIndex).toBe(1);
    expect(steps[2].stepIndex).toBe(2);
    expect(steps[0].server).toBe('server-a');
  });

  it('should update run status with durationMs', () => {
    const store = createStore();
    const workflow = store.createWorkflow({ name: 'W1', triggerEvent: 'e1', steps: [] });
    const run = store.createRun(workflow.id, {});

    store.updateRun(run.id, {
      status: 'completed',
      completedAt: '2025-01-01T00:00:00.000Z',
      durationMs: 1500,
    });

    const updated = store.getRun(run.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.durationMs).toBe(1500);
    expect(updated?.completedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('should return undefined for non-existent workflow and run', () => {
    const store = createStore();
    expect(store.getWorkflow(999)).toBeUndefined();
    expect(store.getRun(999)).toBeUndefined();
  });
});
