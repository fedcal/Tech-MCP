import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { createAgileMetricsServer } from '../../src/server.js';

describe('correlate-factors tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should save and retrieve a correlation', async () => {
    const suite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'correlate-factors',
      arguments: {
        factorA: 'team-size',
        factorB: 'velocity',
        correlation: 0.85,
        sampleSize: 10,
        description: 'Larger teams have higher velocity',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const corr = JSON.parse(content[0].text);
    expect(corr.factorA).toBe('team-size');
    expect(corr.correlation).toBe(0.85);
  });

  it('should list correlations when no params provided', async () => {
    const suite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Save one first
    await harness.client.callTool({
      name: 'correlate-factors',
      arguments: {
        factorA: 'meetings',
        factorB: 'velocity',
        correlation: -0.4,
        sampleSize: 8,
      },
    });

    // List
    const result = await harness.client.callTool({
      name: 'correlate-factors',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const list = JSON.parse(content[0].text);
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
  });
});
