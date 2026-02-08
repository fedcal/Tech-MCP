/**
 * Integration test: workflow-orchestrator -> retrospective-manager (create-retro)
 * Verifies that trigger-workflow can execute steps on retrospective-manager via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, MockEventBus, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createWorkflowOrchestratorServer } from '../../src/server.js';
import { createRetrospectiveManagerServer } from '../../../retrospective-manager/src/server.js';

describe('trigger-workflow -> retrospective-manager wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should execute workflow steps on target server', async () => {
    // 1. Create target server (retrospective-manager) in-memory
    const targetSuite = createRetrospectiveManagerServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager via InMemoryTransport
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('retrospective-manager', clientTransport);

    // 3. Create caller server (workflow-orchestrator) with clientManager and MockEventBus
    const eventBus = new MockEventBus();
    const callerSuite = createWorkflowOrchestratorServer({
      eventBus,
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Create a workflow that calls create-retro on retrospective-manager
    const createResult = await callerHarness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Auto retro on incident',
        triggerEvent: 'incident:resolved',
        steps: [
          {
            server: 'retrospective-manager',
            tool: 'create-retro',
            arguments: { sprintId: '{{payload.incidentId}}', format: 'start-stop-continue' },
          },
        ],
      },
    });
    const workflow = JSON.parse(
      (createResult.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(workflow.id).toBeDefined();

    // 5. Trigger the workflow manually
    const triggerResult = await callerHarness.client.callTool({
      name: 'trigger-workflow',
      arguments: {
        workflowId: workflow.id,
        payload: { incidentId: 'INC-42' },
      },
    });
    const run = JSON.parse(
      (triggerResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    // 6. Verify the run completed successfully
    expect(run.status).toBe('completed');
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].status).toBe('completed');

    // 7. Verify events were published
    expect(eventBus.wasPublished('workflow:triggered')).toBe(true);
    expect(eventBus.wasPublished('workflow:completed')).toBe(true);
  });

  it('should resolve template variables from payload', async () => {
    // 1. Create target server
    const targetSuite = createRetrospectiveManagerServer({ storeOptions: { inMemory: true } });

    // 2. Wire to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('retrospective-manager', clientTransport);

    // 3. Create caller server
    const eventBus = new MockEventBus();
    const callerSuite = createWorkflowOrchestratorServer({
      eventBus,
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Create workflow with template variable
    const createResult = await callerHarness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Retro for sprint',
        triggerEvent: 'sprint:completed',
        steps: [
          {
            server: 'retrospective-manager',
            tool: 'create-retro',
            arguments: { sprintId: '{{payload.sprintName}}', format: 'mad-sad-glad' },
          },
        ],
      },
    });
    const workflow = JSON.parse(
      (createResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    // 5. Trigger with a specific payload
    const triggerResult = await callerHarness.client.callTool({
      name: 'trigger-workflow',
      arguments: {
        workflowId: workflow.id,
        payload: { sprintName: 'Sprint-7' },
      },
    });
    const run = JSON.parse(
      (triggerResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    expect(run.status).toBe('completed');

    // 6. Get the workflow run details to inspect the step results
    const runDetailResult = await callerHarness.client.callTool({
      name: 'get-workflow-run',
      arguments: { runId: run.id },
    });
    const runDetail = JSON.parse(
      (runDetailResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    // The step result should contain the retro created with sprintId = 'Sprint-7'
    // create-retro returns { retro: { sprintId, format, ... }, categories: {}, actionItems: [] }
    expect(runDetail.steps[0].result).toBeDefined();
    expect(runDetail.steps[0].result.retro).toBeDefined();
    expect(runDetail.steps[0].result.retro.sprintId).toBe('Sprint-7');
    expect(runDetail.steps[0].result.retro.format).toBe('mad-sad-glad');
  });

  it('should fail gracefully when target server is unreachable', async () => {
    // Create workflow-orchestrator with an empty clientManager (no servers registered)
    clientManager = new McpClientManager();
    const eventBus = new MockEventBus();
    const callerSuite = createWorkflowOrchestratorServer({
      eventBus,
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // Create a workflow that targets a non-connected server
    const createResult = await callerHarness.client.callTool({
      name: 'create-workflow',
      arguments: {
        name: 'Failing workflow',
        triggerEvent: 'test:event',
        steps: [
          {
            server: 'retrospective-manager',
            tool: 'create-retro',
            arguments: { format: 'start-stop-continue' },
          },
        ],
      },
    });
    const workflow = JSON.parse(
      (createResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    // Trigger the workflow - should fail because retrospective-manager is not connected
    const triggerResult = await callerHarness.client.callTool({
      name: 'trigger-workflow',
      arguments: {
        workflowId: workflow.id,
        payload: {},
      },
    });
    const run = JSON.parse(
      (triggerResult.content as Array<{ type: string; text: string }>)[0].text,
    );

    // Verify that the run failed
    expect(run.status).toBe('failed');
    expect(run.error).toBeDefined();

    // Verify workflow:failed event was published
    expect(eventBus.wasPublished('workflow:triggered')).toBe(true);
    expect(eventBus.wasPublished('workflow:failed')).toBe(true);
  });
});
