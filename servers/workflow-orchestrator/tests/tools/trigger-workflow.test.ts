import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createWorkflowOrchestratorServer } from '../../src/server.js';

describe('trigger-workflow tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should trigger workflow and publish workflow:triggered then workflow:failed (no clientManager)', async () => {
    const eventBus = new MockEventBus();
    const suite = createWorkflowOrchestratorServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Create a workflow with a step (will fail because no clientManager)
    const createResult = await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Test WF',
        triggerEvent: 'test:event',
        steps: [{ server: 'some-server', tool: 'some-tool', arguments: {} }],
      },
    });
    const workflow = JSON.parse((createResult.content as Array<{ type: string; text: string }>)[0].text);

    const triggerResult = await harness.client.callTool({
      name: 'trigger-workflow',
      arguments: { workflowId: workflow.id, payload: {} },
    });

    const run = JSON.parse((triggerResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(run.status).toBe('failed');
    expect(run.error).toContain('ClientManager not available');

    expect(eventBus.wasPublished('workflow:triggered')).toBe(true);
    expect(eventBus.wasPublished('workflow:failed')).toBe(true);
  });

  it('should return error for non-existent workflow', async () => {
    const suite = createWorkflowOrchestratorServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'trigger-workflow',
      arguments: { workflowId: 999 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('not found');
    expect(result.isError).toBe(true);
  });

  it('should return error for inactive workflow', async () => {
    const suite = createWorkflowOrchestratorServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const createResult = await harness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Inactive WF',
        triggerEvent: 'test:event',
        steps: [],
      },
    });
    const workflow = JSON.parse((createResult.content as Array<{ type: string; text: string }>)[0].text);

    await harness.client.callTool({
      name: 'toggle-workflow',
      arguments: { workflowId: workflow.id, active: false },
    });

    const result = await harness.client.callTool({
      name: 'trigger-workflow',
      arguments: { workflowId: workflow.id },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('inactive');
    expect(result.isError).toBe(true);
  });
});
