import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { createTimeTrackingServer } from '../../src/server.js';

describe('estimate-vs-actual tool', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) await harness.close();
  });

  it('should save estimate and compare with actual', async () => {
    const suite = createTimeTrackingServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    // Log actual time
    await harness.client.callTool({
      name: 'log-time',
      arguments: { taskId: 'TASK-1', durationMinutes: 90 },
    });

    // Set estimate and compare
    const result = await harness.client.callTool({
      name: 'estimate-vs-actual',
      arguments: { taskId: 'TASK-1', estimateMinutes: 120 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const comparison = JSON.parse(content[0].text);
    expect(comparison.taskId).toBe('TASK-1');
    expect(comparison.estimateMinutes).toBe(120);
    expect(comparison.actualMinutes).toBe(90);
    expect(comparison.differenceMinutes).toBe(-30);
    expect(comparison.accuracy).toBeGreaterThan(0);
  });

  it('should return message when no estimate exists', async () => {
    const suite = createTimeTrackingServer({ storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);

    const result = await harness.client.callTool({
      name: 'estimate-vs-actual',
      arguments: { taskId: 'NO-ESTIMATE' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('No estimate found');
  });
});
