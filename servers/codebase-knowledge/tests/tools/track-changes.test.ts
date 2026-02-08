import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createCodebaseKnowledgeServer } from '../../src/server.js';

describe('track-changes tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should track a change and return it', async () => {
    const suite = createCodebaseKnowledgeServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'track-changes',
      arguments: {
        modulePath: 'src/auth',
        changeType: 'feature',
        description: 'Added OAuth2 support',
        filesChanged: 5,
        author: 'dev@example.com',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const change = JSON.parse(content[0].text);
    expect(change.modulePath).toBe('src/auth');
    expect(change.changeType).toBe('feature');
    expect(change.filesChanged).toBe(5);
  });

  it('should return change history when no changeType provided', async () => {
    const suite = createCodebaseKnowledgeServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Track some changes first
    await harness.client.callTool({
      name: 'track-changes',
      arguments: {
        modulePath: 'src/api',
        changeType: 'bugfix',
        description: 'Fixed null pointer',
      },
    });

    // Get history
    const result = await harness.client.callTool({
      name: 'track-changes',
      arguments: { modulePath: 'src/api' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const history = JSON.parse(content[0].text);
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(1);
  });

  it('should publish knowledge:index-updated event', async () => {
    const eventBus = new MockEventBus();
    const suite = createCodebaseKnowledgeServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'track-changes',
      arguments: {
        modulePath: 'src/core',
        changeType: 'refactor',
        description: 'Simplified error handling',
        filesChanged: 3,
      },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'knowledge:index-updated',
        payload: expect.objectContaining({ directory: 'src/core', filesIndexed: 3 }),
      }),
    );
  });
});
