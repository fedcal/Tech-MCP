import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, type TestHarness, MockEventBus } from '@mcp-suite/testing';
import { createScrumBoardServer } from '../../src/server.js';

describe('create-sprint', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    const suite = createScrumBoardServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);
  });

  afterEach(async () => {
    await harness.close();
  });

  it('should create a sprint and return valid JSON with id, name, and dates', async () => {
    const result = await harness.client.callTool({
      name: 'create-sprint',
      arguments: {
        name: 'Sprint 12',
        startDate: '2025-06-01',
        endDate: '2025-06-14',
        goals: ['Deliver auth module', 'Fix navigation bugs'],
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);
    expect(parsed.id).toBeDefined();
    expect(typeof parsed.id).toBe('number');
    expect(parsed.name).toBe('Sprint 12');
    expect(parsed.startDate).toBe('2025-06-01');
    expect(parsed.endDate).toBe('2025-06-14');
    expect(parsed.goals).toEqual(['Deliver auth module', 'Fix navigation bugs']);
    expect(parsed.status).toBe('planning');
    expect(parsed.createdAt).toBeDefined();
  });

  it('should publish scrum:sprint-started event', async () => {
    await harness.client.callTool({
      name: 'create-sprint',
      arguments: {
        name: 'Sprint 13',
        startDate: '2025-06-15',
        endDate: '2025-06-28',
        goals: ['Performance improvements'],
      },
    });

    expect(eventBus.wasPublished('scrum:sprint-started')).toBe(true);

    const events = eventBus.getPublishedEvents('scrum:sprint-started');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      sprintId: string;
      name: string;
      startDate: string;
      endDate: string;
    };
    expect(payload.name).toBe('Sprint 13');
    expect(payload.startDate).toBe('2025-06-15');
    expect(payload.endDate).toBe('2025-06-28');
    expect(payload.sprintId).toBeDefined();
  });
});
