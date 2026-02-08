import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { createDashboardApiServer } from '../../src/server.js';

describe('get-server-status tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should return registry-unavailable when no clientManager', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-server-status',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0].text);
    expect(status.status).toBe('registry-unavailable');
    expect(status.message).toBeDefined();
  });

  it('should return structure with status field', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-server-status',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0].text);
    expect(status).toHaveProperty('status');
  });

  it('should handle serverName filter param', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-server-status',
      arguments: { serverName: 'agile-metrics' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0].text);
    // Without clientManager it returns registry-unavailable regardless of filter
    expect(status.status).toBe('registry-unavailable');
  });

  it('should return JSON without errors', async () => {
    const suite = createDashboardApiServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'get-server-status',
      arguments: {},
    });

    expect(result.isError).toBeUndefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(() => JSON.parse(content[0].text)).not.toThrow();
  });
});
