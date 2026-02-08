import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, type TestHarness, MockEventBus } from '@mcp-suite/testing';
import { createTimeTrackingServer } from '../../src/server.js';

describe('log-time', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    const suite = createTimeTrackingServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);
  });

  afterEach(async () => {
    await harness.close();
  });

  it('should log time and return a valid entry', async () => {
    const result = await harness.client.callTool({
      name: 'log-time',
      arguments: {
        taskId: 'TASK-42',
        durationMinutes: 90,
        description: 'Implemented authentication flow',
        date: '2025-06-10',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);
    expect(parsed.message).toContain('90 minutes');
    expect(parsed.message).toContain('TASK-42');
    expect(parsed.entry).toBeDefined();
    expect(parsed.entry.taskId).toBe('TASK-42');
    expect(parsed.entry.durationMinutes).toBe(90);
    expect(parsed.entry.description).toBe('Implemented authentication flow');
    expect(parsed.entry.date).toBe('2025-06-10');
    expect(parsed.entry.id).toBeDefined();
  });

  it('should default to today when no date is provided', async () => {
    const result = await harness.client.callTool({
      name: 'log-time',
      arguments: {
        taskId: 'TASK-99',
        durationMinutes: 30,
      },
    });

    const parsed = JSON.parse(
      (result.content as Array<{ text: string }>)[0].text,
    );
    expect(parsed.entry.date).toBeDefined();
    // The date should be in YYYY-MM-DD format
    expect(parsed.entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should publish time:entry-logged event', async () => {
    await harness.client.callTool({
      name: 'log-time',
      arguments: {
        taskId: 'TASK-55',
        durationMinutes: 120,
        description: 'Code review',
        date: '2025-06-11',
      },
    });

    expect(eventBus.wasPublished('time:entry-logged')).toBe(true);

    const events = eventBus.getPublishedEvents('time:entry-logged');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      taskId: string;
      userId: string;
      minutes: number;
      date: string;
    };
    expect(payload.taskId).toBe('TASK-55');
    expect(payload.userId).toBe('default');
    expect(payload.minutes).toBe(120);
    expect(payload.date).toBe('2025-06-11');
  });
});
