import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createInsightEngineServer } from '../../src/server.js';

describe('health-dashboard tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should return health dashboard structure even without clientManager', async () => {
    const suite = createInsightEngineServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);
    expect(dashboard).toHaveProperty('healthScore', 0);
    expect(dashboard).toHaveProperty('velocity');
    expect(dashboard).toHaveProperty('timeTracking');
    expect(dashboard).toHaveProperty('budget');
    expect(dashboard).toHaveProperty('dataSources');
    expect(dashboard).toHaveProperty('generatedAt');
    expect(dashboard).toHaveProperty('cached', false);
  });

  it('should include dataSources field showing unavailable servers', async () => {
    const suite = createInsightEngineServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);
    const ds = dashboard.dataSources;
    expect(ds['agile-metrics']).toBe('unavailable');
    expect(ds['time-tracking']).toBe('unavailable');
    expect(ds['project-economics']).toBe('unavailable');
  });

  it('should use cache for repeated calls', async () => {
    const suite = createInsightEngineServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // First call - not cached
    const result1 = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: {},
    });
    const content1 = result1.content as Array<{ type: string; text: string }>;
    const dashboard1 = JSON.parse(content1[0].text);
    expect(dashboard1.cached).toBe(false);

    // Second call - should be cached
    const result2 = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: {},
    });
    const content2 = result2.content as Array<{ type: string; text: string }>;
    const dashboard2 = JSON.parse(content2[0].text);
    expect(dashboard2.cached).toBe(true);
  });

  it('should force refresh bypassing cache', async () => {
    const suite = createInsightEngineServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // First call to populate cache
    await harness.client.callTool({
      name: 'health-dashboard',
      arguments: {},
    });

    // Force refresh - should bypass cache
    const result = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: { forceRefresh: true },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);
    expect(dashboard.cached).toBe(false);
    expect(dashboard.healthScore).toBe(0);
  });

  it('should degrade gracefully showing unavailable sources', async () => {
    const eventBus = new MockEventBus();
    const suite = createInsightEngineServer({
      eventBus,
      storeOptions: { inMemory: true },
    });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'health-dashboard',
      arguments: { forceRefresh: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const dashboard = JSON.parse(content[0].text);

    // All sources should show as unavailable (no real servers connected)
    expect(dashboard.healthScore).toBe(0);
    expect(dashboard.velocity).toEqual({ status: 'unavailable' });
    expect(dashboard.timeTracking).toEqual({ status: 'unavailable' });
    expect(dashboard.budget).toEqual({ status: 'unavailable' });
    expect(result.isError).toBeUndefined();
  });
});
