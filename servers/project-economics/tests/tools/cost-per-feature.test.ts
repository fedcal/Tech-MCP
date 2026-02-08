import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createProjectEconomicsServer } from '../../src/server.js';

describe('cost-per-feature tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should track cost per feature', async () => {
    const suite = createProjectEconomicsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: {
        featureId: 'FEAT-1',
        projectName: 'MyProject',
        hoursSpent: 10,
        hourlyRate: 50,
        description: 'Frontend implementation',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const cost = JSON.parse(content[0].text);
    expect(cost.featureId).toBe('FEAT-1');
    expect(cost.totalCost).toBe(500);
    expect(cost.hoursSpent).toBe(10);
  });

  it('should accumulate costs for same feature', async () => {
    const suite = createProjectEconomicsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // First cost entry
    await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: {
        featureId: 'FEAT-2',
        projectName: 'MyProject',
        hoursSpent: 5,
        hourlyRate: 60,
      },
    });

    // Second cost entry
    const result = await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: {
        featureId: 'FEAT-2',
        projectName: 'MyProject',
        hoursSpent: 3,
        hourlyRate: 60,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const cost = JSON.parse(content[0].text);
    expect(cost.hoursSpent).toBe(8);
    expect(cost.totalCost).toBe(480);
  });

  it('should publish economics:feature-costed event', async () => {
    const eventBus = new MockEventBus();
    const suite = createProjectEconomicsServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: {
        featureId: 'FEAT-3',
        projectName: 'Test',
        hoursSpent: 2,
        hourlyRate: 40,
      },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'economics:feature-costed',
        payload: expect.objectContaining({
          featureId: 'FEAT-3',
          totalCost: 80,
        }),
      }),
    );
  });

  it('should list all feature costs for a project', async () => {
    const suite = createProjectEconomicsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Track some costs
    await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: { featureId: 'F-1', projectName: 'Proj', hoursSpent: 5, hourlyRate: 50 },
    });
    await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: { featureId: 'F-2', projectName: 'Proj', hoursSpent: 10, hourlyRate: 50 },
    });

    // List
    const result = await harness.client.callTool({
      name: 'cost-per-feature',
      arguments: { projectName: 'Proj' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const costs = JSON.parse(content[0].text);
    expect(Array.isArray(costs)).toBe(true);
    expect(costs).toHaveLength(2);
  });
});
