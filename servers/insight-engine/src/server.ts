/**
 * Factory for the Insight Engine MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { InsightStore } from './services/insight-store.js';
import { CorrelationEngine } from './services/correlation-engine.js';
import { registerQueryInsight } from './tools/query-insight.js';
import { registerCorrelateMetrics } from './tools/correlate-metrics.js';
import { registerExplainTrend } from './tools/explain-trend.js';
import { registerHealthDashboard } from './tools/health-dashboard.js';

export function createInsightEngineServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'insight-engine',
    version: '0.1.0',
    description: 'MCP server for cross-server intelligence and metric correlation',
    eventBus: options?.eventBus,
  });

  const store = new InsightStore(options?.storeOptions);
  const engine = new CorrelationEngine(options?.clientManager);

  registerQueryInsight(suite.server, store, engine);
  registerCorrelateMetrics(suite.server, store, engine);
  registerExplainTrend(suite.server, store, engine);
  registerHealthDashboard(suite.server, store, engine);

  // No collaboration handlers - consumer only
  suite.logger.info('All insight-engine tools registered');

  return suite;
}
