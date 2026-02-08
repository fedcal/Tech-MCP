import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, type TestHarness, MockEventBus } from '@mcp-suite/testing';
import { createProjectEconomicsServer } from '../../src/server.js';

describe('log-cost', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    const suite = createProjectEconomicsServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);
  });

  afterEach(async () => {
    await harness.close();
  });

  /**
   * Helper: create a budget so we can log costs against it.
   */
  async function createBudget(projectName = 'Project Alpha', totalBudget = 50000): Promise<void> {
    await harness.client.callTool({
      name: 'set-budget',
      arguments: {
        projectName,
        totalBudget,
        currency: 'EUR',
      },
    });
  }

  it('should log a cost and return a valid result', async () => {
    await createBudget();

    const result = await harness.client.callTool({
      name: 'log-cost',
      arguments: {
        projectName: 'Project Alpha',
        category: 'development',
        amount: 1500,
        description: 'Senior developer - 2 days',
        date: '2025-06-10',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);
    expect(parsed.id).toBeDefined();
    expect(typeof parsed.id).toBe('number');
    expect(parsed.category).toBe('development');
    expect(parsed.amount).toBe(1500);
    expect(parsed.description).toBe('Senior developer - 2 days');
    expect(parsed.date).toBe('2025-06-10');
  });

  it('should publish economics:cost-updated event', async () => {
    await createBudget();

    // Clear events from budget setup
    eventBus.published = [];

    await harness.client.callTool({
      name: 'log-cost',
      arguments: {
        projectName: 'Project Alpha',
        category: 'infrastructure',
        amount: 250,
        description: 'Cloud hosting monthly fee',
        date: '2025-06-01',
      },
    });

    expect(eventBus.wasPublished('economics:cost-updated')).toBe(true);

    const events = eventBus.getPublishedEvents('economics:cost-updated');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      category: string;
      amount: number;
      totalSpent: number;
    };
    expect(payload.category).toBe('infrastructure');
    expect(payload.amount).toBe(250);
    expect(payload.totalSpent).toBeDefined();
  });

  it('should return error when logging cost for non-existent project', async () => {
    const result = await harness.client.callTool({
      name: 'log-cost',
      arguments: {
        projectName: 'Ghost Project',
        category: 'development',
        amount: 100,
        description: 'Some work',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('No budget found');
    expect(result.isError).toBe(true);
  });
});
