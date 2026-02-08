import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { createWorkflowOrchestratorServer } from '../../src/server.js';

describe('create-workflow / list-workflows / toggle-workflow tools', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should create a workflow and verify return', async () => {
    const suite = createWorkflowOrchestratorServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Deploy Pipeline',
        description: 'Triggered on sprint completion',
        triggerEvent: 'scrum:sprint-completed',
        triggerConditions: { velocity: 20 },
        steps: [
          { server: 'agile-metrics', tool: 'calculate-velocity', arguments: { sprintId: '{{payload.sprintId}}' } },
        ],
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const workflow = JSON.parse(content[0].text);
    expect(workflow.name).toBe('Deploy Pipeline');
    expect(workflow.triggerEvent).toBe('scrum:sprint-completed');
    expect(workflow.steps).toHaveLength(1);
    expect(workflow.active).toBe(true);
  });

  it('should list workflows and return array', async () => {
    const suite = createWorkflowOrchestratorServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'W1',
        triggerEvent: 'e1',
        steps: [],
      },
    });
    await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'W2',
        triggerEvent: 'e2',
        steps: [],
      },
    });

    const result = await harness.client.callTool({
      name: 'list-workflows',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const workflows = JSON.parse(content[0].text);
    expect(workflows).toHaveLength(2);
  });

  it('should toggle workflow active status', async () => {
    const suite = createWorkflowOrchestratorServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const createResult = await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Toggle Test',
        triggerEvent: 'e1',
        steps: [],
      },
    });

    const created = JSON.parse((createResult.content as Array<{ type: string; text: string }>)[0].text);

    const toggleResult = await harness.client.callTool({
      name: 'toggle-workflow',
      arguments: {
        workflowId: created.id,
        active: false,
      },
    });

    const toggled = JSON.parse((toggleResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(toggled.active).toBe(false);
  });
});
