import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createRetrospectiveManagerServer } from '../../src/server.js';

describe('detect-patterns tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should detect patterns across retros', async () => {
    const suite = createRetrospectiveManagerServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Create two retros with similar items
    const retro1Result = await harness.client.callTool({
      name: 'create-retro',
      arguments: { format: 'mad-sad-glad' },
    });
    const retro1 = JSON.parse((retro1Result.content as Array<{ text: string }>)[0].text);

    const retro2Result = await harness.client.callTool({
      name: 'create-retro',
      arguments: { format: 'mad-sad-glad' },
    });
    const retro2 = JSON.parse((retro2Result.content as Array<{ text: string }>)[0].text);

    // Add similar items to both retros
    await harness.client.callTool({
      name: 'add-retro-item',
      arguments: { retroId: retro1.retro.id, category: 'mad', content: 'Deployment pipeline keeps breaking intermittently' },
    });
    await harness.client.callTool({
      name: 'add-retro-item',
      arguments: { retroId: retro2.retro.id, category: 'mad', content: 'Deployment pipeline keeps breaking intermittently' },
    });

    // Detect patterns
    const result = await harness.client.callTool({
      name: 'detect-patterns',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0].text);
    expect(data.newPatternsFound).toBeGreaterThan(0);
  });

  it('should publish retro:pattern-detected event', async () => {
    const eventBus = new MockEventBus();
    const suite = createRetrospectiveManagerServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Create two retros with same item
    const r1 = await harness.client.callTool({ name: 'create-retro', arguments: { format: 'start-stop-continue' } });
    const r2 = await harness.client.callTool({ name: 'create-retro', arguments: { format: 'start-stop-continue' } });
    const retro1 = JSON.parse((r1.content as Array<{ text: string }>)[0].text);
    const retro2 = JSON.parse((r2.content as Array<{ text: string }>)[0].text);

    await harness.client.callTool({
      name: 'add-retro-item',
      arguments: { retroId: retro1.retro.id, category: 'start', content: 'Better code review practices needed' },
    });
    await harness.client.callTool({
      name: 'add-retro-item',
      arguments: { retroId: retro2.retro.id, category: 'start', content: 'Better code review practices needed' },
    });

    await harness.client.callTool({ name: 'detect-patterns', arguments: {} });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'retro:pattern-detected',
      }),
    );
  });
});
