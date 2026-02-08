import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createDecisionLogServer } from '../../src/server.js';

describe('record-decision tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should record a decision and return it', async () => {
    const suite = createDecisionLogServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'record-decision',
      arguments: {
        title: 'Use TypeScript',
        context: 'We need type safety',
        decision: 'TypeScript for all new code',
        alternatives: ['JavaScript', 'Flow'],
        consequences: 'Steeper learning curve',
        status: 'accepted',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const decision = JSON.parse(content[0].text);
    expect(decision.title).toBe('Use TypeScript');
    expect(decision.status).toBe('accepted');
    expect(decision.alternatives).toEqual(['JavaScript', 'Flow']);
  });

  it('should publish decision:created event', async () => {
    const eventBus = new MockEventBus();
    const suite = createDecisionLogServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'record-decision',
      arguments: {
        title: 'Use Docker',
        context: 'Need containerization',
        decision: 'Docker for all services',
      },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'decision:created',
        payload: expect.objectContaining({ title: 'Use Docker' }),
      }),
    );
  });
});
