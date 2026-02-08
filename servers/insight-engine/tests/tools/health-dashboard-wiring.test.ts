/**
 * Integration test: insight-engine -> agile-metrics + time-tracking
 * Verifies that health-dashboard aggregates data from multiple servers via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createInsightEngineServer } from '../../src/server.js';
import { createAgileMetricsServer } from '../../../agile-metrics/src/server.js';
import { createTimeTrackingServer } from '../../../time-tracking/src/server.js';

describe('health-dashboard -> agile-metrics + time-tracking wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should return health data from connected servers', async () => {
    // 1. Create agile-metrics in-memory and wire to clientManager
    const metricsSuite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    clientManager = new McpClientManager();
    const [ct1, st1] = McpClientManager.createInMemoryPair();
    await metricsSuite.server.connect(st1);
    await clientManager.connectInMemoryWithTransport('agile-metrics', ct1);

    // 2. Create time-tracking in-memory and wire to clientManager
    const timeSuite = createTimeTrackingServer({ storeOptions: { inMemory: true } });
    const [ct2, st2] = McpClientManager.createInMemoryPair();
    await timeSuite.server.connect(st2);
    await clientManager.connectInMemoryWithTransport('time-tracking', ct2);

    // 3. Populate time-tracking data
    await clientManager.callTool('time-tracking', 'log-time', {
      taskId: 'TASK-1',
      durationMinutes: 120,
      description: 'Dev work',
    });

    // 4. Create insight-engine with clientManager
    const callerSuite = createInsightEngineServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Call health-dashboard with forceRefresh to bypass any cache
    const result = await callerHarness.client.callTool({
      name: 'health-dashboard',
      arguments: { forceRefresh: true },
    });
    const dashboard = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    // 6. Verify that both connected servers show as available
    expect(dashboard.dataSources['agile-metrics']).toBe('available');
    expect(dashboard.dataSources['time-tracking']).toBe('available');
    // project-economics is not connected -> unavailable
    expect(dashboard.dataSources['project-economics']).toBe('unavailable');

    // Health score: 2 out of 3 servers available = 67%
    expect(dashboard.healthScore).toBe(67);

    // Verify time-tracking data is present (timesheet was populated)
    expect(dashboard.timeTracking).toBeDefined();
    expect(dashboard.timeTracking.totalMinutes).toBe(120);
    expect(dashboard.timeTracking.entryCount).toBe(1);

    // Velocity data should be present (calculate-velocity was called with default data)
    expect(dashboard.velocity).toBeDefined();
    expect(dashboard.velocity.status).toBeUndefined(); // not 'unavailable' since the server responded
  });

  it('should degrade gracefully with partial server availability', async () => {
    // Only agile-metrics connected, time-tracking and project-economics are not
    const metricsSuite = createAgileMetricsServer({ storeOptions: { inMemory: true } });
    clientManager = new McpClientManager();
    const [ct1, st1] = McpClientManager.createInMemoryPair();
    await metricsSuite.server.connect(st1);
    await clientManager.connectInMemoryWithTransport('agile-metrics', ct1);

    const callerSuite = createInsightEngineServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    const result = await callerHarness.client.callTool({
      name: 'health-dashboard',
      arguments: { forceRefresh: true },
    });
    const dashboard = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    // Only agile-metrics is available
    expect(dashboard.dataSources['agile-metrics']).toBe('available');
    expect(dashboard.dataSources['time-tracking']).toBe('unavailable');
    expect(dashboard.dataSources['project-economics']).toBe('unavailable');

    // Health score: 1 out of 3 = 33%
    expect(dashboard.healthScore).toBe(33);

    // Unavailable servers should return status: 'unavailable'
    expect(dashboard.timeTracking).toEqual({ status: 'unavailable' });
    expect(dashboard.budget).toEqual({ status: 'unavailable' });
  });

  it('should degrade gracefully with no servers available', async () => {
    // No servers connected at all
    clientManager = new McpClientManager();

    const callerSuite = createInsightEngineServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    const result = await callerHarness.client.callTool({
      name: 'health-dashboard',
      arguments: { forceRefresh: true },
    });
    const dashboard = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );

    // All servers unavailable
    expect(dashboard.dataSources['agile-metrics']).toBe('unavailable');
    expect(dashboard.dataSources['time-tracking']).toBe('unavailable');
    expect(dashboard.dataSources['project-economics']).toBe('unavailable');

    // Health score: 0 out of 3 = 0%
    expect(dashboard.healthScore).toBe(0);
  });
});
