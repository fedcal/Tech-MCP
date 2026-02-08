/**
 * Time Tracking MCP Server
 * Tools for tracking time spent on tasks with timers and manual logging.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { TimeStore } from './services/time-store.js';
import { registerStartTimer } from './tools/start-timer.js';
import { registerStopTimer } from './tools/stop-timer.js';
import { registerLogTime } from './tools/log-time.js';
import { registerGetTimesheet } from './tools/get-timesheet.js';
import { registerDetectAnomalies } from './tools/detect-anomalies.js';
import { registerEstimateVsActual } from './tools/estimate-vs-actual.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createTimeTrackingServer(options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } }): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'time-tracking',
    version: '0.1.0',
    description: 'MCP server for tracking time spent on tasks',
    eventBus,
  });

  const store = new TimeStore(options?.storeOptions);

  // Register all tools
  registerStartTimer(suite.server, store);
  registerStopTimer(suite.server, store, suite.eventBus);
  registerLogTime(suite.server, store, suite.eventBus);
  registerGetTimesheet(suite.server, store);
  registerDetectAnomalies(suite.server, store, suite.eventBus);
  registerEstimateVsActual(suite.server, store);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All time-tracking tools registered');

  return suite;
}
