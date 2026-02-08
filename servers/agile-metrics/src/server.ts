/**
 * Agile Metrics MCP Server
 * Tools for calculating agile project metrics like velocity, burndown, cycle time, and forecasting.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { MetricsStore } from './services/metrics-store.js';
import { registerCalculateVelocity } from './tools/calculate-velocity.js';
import { registerGenerateBurndown } from './tools/generate-burndown.js';
import { registerCalculateCycleTime } from './tools/calculate-cycle-time.js';
import { registerForecastCompletion } from './tools/forecast-completion.js';
import { registerPredictRisk } from './tools/predict-risk.js';
import { registerCorrelateFactor } from './tools/correlate-factors.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createAgileMetricsServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'agile-metrics',
    version: '0.1.0',
    description: 'MCP server for calculating agile project metrics',
    eventBus: options?.eventBus,
  });

  const store = new MetricsStore(options?.storeOptions);

  // Register all tools
  registerCalculateVelocity(suite.server, store, options?.clientManager);
  registerGenerateBurndown(suite.server, store);
  registerCalculateCycleTime(suite.server, store, options?.clientManager);
  registerForecastCompletion(suite.server, store);
  registerPredictRisk(suite.server, store, suite.eventBus);
  registerCorrelateFactor(suite.server, store);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All agile-metrics tools registered');

  return suite;
}
