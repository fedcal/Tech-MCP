import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createAccessPolicyServer } from '../../src/server.js';

describe('check-access tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should allow access when policy matches', async () => {
    const suite = createAccessPolicyServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Set up: assign role and create allow policy
    await harness.client.callTool({
      name: 'assign-role',
      arguments: { userId: 'alice', roleName: 'developer' },
    });

    await harness.client.callTool({
      name: 'create-policy',
      arguments: {
        name: 'allow-devs-scrum',
        effect: 'allow',
        rules: [{ server: 'scrum-board', roles: ['developer'] }],
      },
    });

    // Check access
    const result = await harness.client.callTool({
      name: 'check-access',
      arguments: { userId: 'alice', server: 'scrum-board' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);
    expect(parsed.allowed).toBe(true);
    expect(parsed.reason).toContain('allow-devs-scrum');
  });

  it('should deny access and publish access:denied event', async () => {
    const eventBus = new MockEventBus();
    const suite = createAccessPolicyServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Set up: assign role but do NOT create an allow policy
    await harness.client.callTool({
      name: 'assign-role',
      arguments: { userId: 'bob', roleName: 'intern' },
    });

    // Check access — should be denied (default deny, no matching allow policy)
    const result = await harness.client.callTool({
      name: 'check-access',
      arguments: { userId: 'bob', server: 'production-deploy', tool: 'deploy' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.allowed).toBe(false);
    expect(parsed.reason).toContain('default deny');

    // Verify event was published
    expect(eventBus.wasPublished('access:denied')).toBe(true);

    const events = eventBus.getPublishedEvents('access:denied');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      userId: string;
      server: string;
      tool: string;
      reason: string;
    };
    expect(payload.userId).toBe('bob');
    expect(payload.server).toBe('production-deploy');
    expect(payload.tool).toBe('deploy');
    expect(payload.reason).toContain('default deny');
  });
});
