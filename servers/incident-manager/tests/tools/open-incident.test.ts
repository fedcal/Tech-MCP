import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createIncidentManagerServer } from '../../src/server.js';

describe('open-incident tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should open an incident and return it', async () => {
    const suite = createIncidentManagerServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'open-incident',
      arguments: {
        title: 'API Gateway down',
        severity: 'critical',
        description: 'All API requests returning 503',
        affectedSystems: ['api-gateway', 'load-balancer'],
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const incident = JSON.parse(content[0].text);
    expect(incident.title).toBe('API Gateway down');
    expect(incident.severity).toBe('critical');
    expect(incident.status).toBe('open');
    expect(incident.affectedSystems).toEqual(['api-gateway', 'load-balancer']);
  });

  it('should publish incident:opened event', async () => {
    const eventBus = new MockEventBus();
    const suite = createIncidentManagerServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    await harness.client.callTool({
      name: 'open-incident',
      arguments: {
        title: 'Database failover',
        severity: 'high',
        description: 'Primary database node failed, failover in progress',
      },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'incident:opened',
        payload: expect.objectContaining({ title: 'Database failover' }),
      }),
    );
  });
});
