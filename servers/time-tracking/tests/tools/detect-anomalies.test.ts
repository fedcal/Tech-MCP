import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { MockEventBus } from '@mcp-suite/testing';
import { createTimeTrackingServer } from '../../src/server.js';

describe('detect-anomalies tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should detect excessive daily hours', async () => {
    const suite = createTimeTrackingServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const today = new Date().toISOString().split('T')[0];

    // Log 11 hours in one day
    await harness.client.callTool({
      name: 'log-time',
      arguments: { taskId: 'TASK-1', durationMinutes: 360, date: today },
    });
    await harness.client.callTool({
      name: 'log-time',
      arguments: { taskId: 'TASK-2', durationMinutes: 300, date: today },
    });

    const result = await harness.client.callTool({
      name: 'detect-anomalies',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0].text);
    expect(report.anomalies.length).toBeGreaterThan(0);
    expect(report.anomalies[0].type).toBe('excessive-daily-hours');
  });

  it('should publish time:anomaly-detected event', async () => {
    const eventBus = new MockEventBus();
    const suite = createTimeTrackingServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const today = new Date().toISOString().split('T')[0];

    await harness.client.callTool({
      name: 'log-time',
      arguments: { taskId: 'TASK-X', durationMinutes: 700, date: today },
    });

    await harness.client.callTool({
      name: 'detect-anomalies',
      arguments: {},
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({
        event: 'time:anomaly-detected',
        payload: expect.objectContaining({ anomalyType: 'excessive-daily-hours' }),
      }),
    );
  });

  it('should return empty anomalies for normal patterns', async () => {
    const suite = createTimeTrackingServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Weekday check - use a known weekday (2026-02-02 is Monday)
    await harness.client.callTool({
      name: 'log-time',
      arguments: { taskId: 'TASK-1', durationMinutes: 120, date: '2026-02-02' },
    });

    const result = await harness.client.callTool({
      name: 'detect-anomalies',
      arguments: { days: 365 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0].text);
    expect(report.anomalies).toHaveLength(0);
  });
});
