import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { createDashboardApiServer } from '../../src/server.js';

describe('get-overview tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should return overview structure even without clientManager', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-overview',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const overview = JSON.parse(content[0].text);
    expect(overview).toBeDefined();
    expect(overview.velocity).toEqual({ status: 'unavailable' });
    expect(overview.timeTracking).toEqual({ status: 'unavailable' });
    expect(overview.budget).toEqual({ status: 'unavailable' });
  });

  it('should include dataSources field showing availability', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-overview',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const overview = JSON.parse(content[0].text);
    expect(overview.dataSources).toBeDefined();
    expect(overview.dataSources.scrumBoard).toBe('unavailable');
    expect(overview.dataSources.velocity).toBe('unavailable');
    expect(overview.dataSources.timeTracking).toBe('unavailable');
    expect(overview.dataSources.budget).toBe('unavailable');
  });

  it('should return JSON without errors', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-overview',
      arguments: {},
    });

    expect(result.isError).toBeUndefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(() => JSON.parse(content[0].text)).not.toThrow();
  });

  it('should have expected sections', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-overview',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const overview = JSON.parse(content[0].text);
    expect(overview).toHaveProperty('velocity');
    expect(overview).toHaveProperty('timeTracking');
    expect(overview).toHaveProperty('budget');
    expect(overview).toHaveProperty('dataSources');
    expect(overview).toHaveProperty('generatedAt');
  });
});
