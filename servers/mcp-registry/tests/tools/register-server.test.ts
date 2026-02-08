import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createMcpRegistryServer } from '../../src/server.js';

describe('register-server tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should register a server and return it', async () => {
    const suite = createMcpRegistryServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'register-server',
      arguments: {
        name: 'decision-log',
        url: 'http://localhost:4000',
        transport: 'http',
        capabilities: ['record-decision', 'list-decisions'],
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const server = JSON.parse(content[0].text);
    expect(server.name).toBe('decision-log');
    expect(server.url).toBe('http://localhost:4000');
    expect(server.transport).toBe('http');
    expect(server.capabilities).toEqual(['record-decision', 'list-decisions']);
    expect(server.status).toBe('unknown');
  });

  it('should publish registry:server-registered event', async () => {
    const eventBus = new MockEventBus();
    const suite = createMcpRegistryServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'register-server',
      arguments: {
        name: 'incident-manager',
        url: 'stdio://local',
      },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'registry:server-registered',
        payload: expect.objectContaining({ serverName: 'incident-manager' }),
      }),
    );
  });
});
