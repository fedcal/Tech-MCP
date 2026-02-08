import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createQualityGateServer } from '../../src/server.js';

describe('evaluate-gate tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should evaluate a passing gate and publish quality:gate-passed event', async () => {
    const eventBus = new MockEventBus();
    const suite = createQualityGateServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // First define a gate
    const defineResult = await harness.client.callTool({
      name: 'define-gate',
      arguments: {
        name: 'CI Gate',
        projectName: 'test-project',
        checks: [
          { metric: 'coverage', operator: '>=', threshold: 80 },
          { metric: 'bugs', operator: '<=', threshold: 0 },
        ],
      },
    });

    const defineContent = defineResult.content as Array<{ type: string; text: string }>;
    const gate = JSON.parse(defineContent[0].text);

    // Clear events from define-gate
    eventBus.clear();

    // Now evaluate the gate
    const evalResult = await harness.client.callTool({
      name: 'evaluate-gate',
      arguments: {
        gateId: gate.id,
        metrics: { coverage: 90, bugs: 0 },
      },
    });

    const evalContent = evalResult.content as Array<{ type: string; text: string }>;
    const evaluation = JSON.parse(evalContent[0].text);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toHaveLength(0);

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'quality:gate-passed',
        payload: expect.objectContaining({ gateName: 'CI Gate' }),
      }),
    );
  });

  it('should evaluate a failing gate and publish quality:gate-failed event', async () => {
    const eventBus = new MockEventBus();
    const suite = createQualityGateServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // First define a gate
    const defineResult = await harness.client.callTool({
      name: 'define-gate',
      arguments: {
        name: 'Strict Gate',
        projectName: 'test-project',
        checks: [
          { metric: 'coverage', operator: '>=', threshold: 95 },
        ],
      },
    });

    const defineContent = defineResult.content as Array<{ type: string; text: string }>;
    const gate = JSON.parse(defineContent[0].text);

    // Clear events from define-gate
    eventBus.clear();

    // Evaluate with failing metrics
    const evalResult = await harness.client.callTool({
      name: 'evaluate-gate',
      arguments: {
        gateId: gate.id,
        metrics: { coverage: 70 },
      },
    });

    const evalContent = evalResult.content as Array<{ type: string; text: string }>;
    const evaluation = JSON.parse(evalContent[0].text);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failures.length).toBeGreaterThan(0);

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'quality:gate-failed',
        payload: expect.objectContaining({
          gateName: 'Strict Gate',
          failures: expect.arrayContaining([expect.stringContaining('coverage')]),
        }),
      }),
    );
  });
});
