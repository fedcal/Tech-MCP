/**
 * Standup Notes MCP Server
 * Tools for logging daily standups, viewing history, and generating status reports.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { StandupStore } from './services/standup-store.js';
import { registerLogStandup } from './tools/log-standup.js';
import { registerGetStandupHistory } from './tools/get-standup-history.js';
import { registerGenerateStatusReport } from './tools/generate-status-report.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createStandupNotesServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'standup-notes',
    version: '0.1.0',
    description: 'MCP server for logging daily standups, viewing history, and generating status reports',
    eventBus,
  });

  const store = new StandupStore(options?.storeOptions?.inMemory);

  // Register all tools
  registerLogStandup(suite.server, store, suite.eventBus);
  registerGetStandupHistory(suite.server, store);
  registerGenerateStatusReport(suite.server, store, options?.clientManager);

  // Setup cross-server collaboration handlers
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All standup-notes tools registered');

  return suite;
}
