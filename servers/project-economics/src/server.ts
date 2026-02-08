/**
 * Project Economics MCP Server
 * Tools for managing project budgets, tracking costs, and forecasting spend.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { EconomicsStore } from './services/economics-store.js';
import { registerSetBudget } from './tools/set-budget.js';
import { registerLogCost } from './tools/log-cost.js';
import { registerGetBudgetStatus } from './tools/get-budget-status.js';
import { registerForecastBudget } from './tools/forecast-budget.js';
import { registerCostPerFeature } from './tools/cost-per-feature.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createProjectEconomicsServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'project-economics',
    version: '0.1.0',
    description: 'MCP server for managing project budgets, tracking costs, and forecasting spend',
    eventBus,
  });

  const store = new EconomicsStore(options?.storeOptions?.inMemory);

  // Register all tools
  registerSetBudget(suite.server, store);
  registerLogCost(suite.server, store, suite.eventBus);
  registerGetBudgetStatus(suite.server, store, suite.eventBus);
  registerForecastBudget(suite.server, store, options?.clientManager);
  registerCostPerFeature(suite.server, store, suite.eventBus);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All project-economics tools registered');

  return suite;
}
