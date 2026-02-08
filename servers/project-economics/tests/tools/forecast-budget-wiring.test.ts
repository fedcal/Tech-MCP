/**
 * Integration test: project-economics → time-tracking (get-timesheet)
 * Verifies that forecast-budget can fetch time data from time-tracking via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createProjectEconomicsServer } from '../../src/server.js';
import { createTimeTrackingServer } from '../../../time-tracking/src/server.js';

describe('forecast-budget → time-tracking wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should include labor analysis from time-tracking in budget forecast', async () => {
    // 1. Create target server (time-tracking)
    const targetSuite = createTimeTrackingServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('time-tracking', clientTransport);

    // 3. Populate time data
    await clientManager.callTool('time-tracking', 'log-time', {
      taskId: 'DEV-1',
      durationMinutes: 480,
      description: 'Development work',
      date: '2025-06-10',
    });

    // 4. Create caller server (project-economics) with clientManager
    const callerSuite = createProjectEconomicsServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Set up a project budget first
    await callerHarness.client.callTool({
      name: 'set-budget',
      arguments: { projectName: 'test-project', totalBudget: 10000, currency: 'EUR' },
    });
    await callerHarness.client.callTool({
      name: 'log-cost',
      arguments: { projectName: 'test-project', amount: 500, category: 'development', description: 'Sprint 1' },
    });

    // 6. Call forecast-budget with includeTimeData
    const result = await callerHarness.client.callTool({
      name: 'forecast-budget',
      arguments: {
        projectName: 'test-project',
        includeTimeData: true,
        hourlyRate: 75,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const forecast = JSON.parse(content[0].text);

    // Should have labor analysis from time-tracking
    expect(forecast.laborAnalysis).toBeDefined();
    expect(forecast.laborAnalysis.trackedHours).toBe(8); // 480 min = 8 hours
    expect(forecast.laborAnalysis.hourlyRate).toBe(75);
    expect(forecast.laborAnalysis.estimatedLaborCost).toBe(600); // 8h * 75
    expect(forecast.laborAnalysis.timesheetEntries).toBe(1);
  });
});
