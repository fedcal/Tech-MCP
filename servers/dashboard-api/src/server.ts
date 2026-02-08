/**
 * Factory for the Dashboard API MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { DashboardStore } from './services/dashboard-store.js';
import { registerGetOverview } from './tools/get-overview.js';
import { registerGetServerStatus } from './tools/get-server-status.js';
import { registerGetRecentActivity } from './tools/get-recent-activity.js';
import { registerGetProjectSummary } from './tools/get-project-summary.js';

export function createDashboardApiServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'dashboard-api',
    version: '0.1.0',
    description: 'MCP server for aggregated dashboard data',
    eventBus: options?.eventBus,
  });

  const store = new DashboardStore(options?.storeOptions);

  registerGetOverview(suite.server, store, options?.clientManager);
  registerGetServerStatus(suite.server, store, options?.clientManager);
  registerGetRecentActivity(suite.server, store, options?.clientManager);
  registerGetProjectSummary(suite.server, store, options?.clientManager);

  // No collaboration handlers for dashboard-api

  suite.logger.info('All dashboard-api tools registered');
  return suite;
}
