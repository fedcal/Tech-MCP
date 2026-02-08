/**
 * Integration test: agile-metrics → time-tracking (get-timesheet)
 * Verifies that calculate-cycle-time can fetch time data from time-tracking via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createAgileMetricsServer } from '../../src/server.js';
import { createTimeTrackingServer } from '../../../time-tracking/src/server.js';

describe('calculate-cycle-time → time-tracking wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should enrich cycle time with time-tracking data', async () => {
    // 1. Create target server (time-tracking)
    const targetSuite = createTimeTrackingServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('time-tracking', clientTransport);

    // 3. Populate test data: log some time entries
    await clientManager.callTool('time-tracking', 'log-time', {
      taskId: 'TASK-1',
      durationMinutes: 120,
      description: 'Feature work',
      date: '2025-06-10',
    });
    await clientManager.callTool('time-tracking', 'log-time', {
      taskId: 'TASK-2',
      durationMinutes: 60,
      description: 'Bug fix',
      date: '2025-06-11',
    });

    // 4. Create caller server (agile-metrics) with clientManager
    const callerSuite = createAgileMetricsServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Call calculate-cycle-time with fetchTimeData
    const result = await callerHarness.client.callTool({
      name: 'calculate-cycle-time',
      arguments: {
        tasks: [
          { startedAt: '2025-06-10T09:00:00Z', completedAt: '2025-06-12T17:00:00Z' },
          { startedAt: '2025-06-11T09:00:00Z', completedAt: '2025-06-13T17:00:00Z' },
        ],
        fetchTimeData: true,
        dateRange: { start: '2025-06-10', end: '2025-06-13' },
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const cycleTime = JSON.parse(content[0].text);

    // Should have cycle time stats
    expect(cycleTime.taskCount).toBe(2);
    expect(cycleTime.averageDays).toBeGreaterThan(0);

    // Should have time-tracking enrichment
    expect(cycleTime.timeTracking).toBeDefined();
    expect(cycleTime.timeTracking.totalTrackedHours).toBe(3); // 180 min = 3 hours
    expect(cycleTime.timeTracking.avgTrackedHoursPerTask).toBe(1.5); // 3h / 2 tasks
  });
});
