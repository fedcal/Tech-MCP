import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createAgileMetricsServer } from '../../src/server.js';

describe('predict-risk tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should predict risk with insufficient history', async () => {
    const suite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'predict-risk',
      arguments: { sprintId: 'Sprint-10' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const prediction = JSON.parse(content[0].text);
    expect(prediction.sprintId).toBe('Sprint-10');
    expect(prediction.riskLevel).toBeDefined();
    expect(prediction.factors).toContain('insufficient-history');
  });

  it('should publish metrics:risk-predicted event', async () => {
    const eventBus = new MockEventBus();
    const suite = createAgileMetricsServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'predict-risk',
      arguments: { sprintId: 'Sprint-5' },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'metrics:risk-predicted',
        payload: expect.objectContaining({ sprintId: 'Sprint-5' }),
      }),
    );
  });

  it('should predict low risk with healthy velocity history', async () => {
    const suite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Add velocity history via calculate-velocity using the sprints array format
    for (let i = 1; i <= 5; i++) {
      await harness.client.callTool({
        name: 'calculate-velocity',
        arguments: {
          sprints: [
            {
              name: `Sprint-${i}`,
              completedPoints: 20,
              totalPoints: 22,
            },
          ],
        },
      });
    }

    const result = await harness.client.callTool({
      name: 'predict-risk',
      arguments: { sprintId: 'Sprint-6' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const prediction = JSON.parse(content[0].text);
    expect(prediction.riskLevel).toBe('low');
  });
});
