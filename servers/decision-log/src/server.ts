/**
 * Factory for the Decision Log MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { DecisionStore } from './services/decision-store.js';
import { registerRecordDecision } from './tools/record-decision.js';
import { registerListDecisions } from './tools/list-decisions.js';
import { registerGetDecision } from './tools/get-decision.js';
import { registerSupersedeDecision } from './tools/supersede-decision.js';
import { registerLinkDecision } from './tools/link-decision.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createDecisionLogServer(
  options?: {
    eventBus?: EventBus;
    storeOptions?: { inMemory?: boolean };
  },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'decision-log',
    version: '0.1.0',
    description: 'MCP server for Architecture Decision Records (ADR)',
    eventBus: options?.eventBus,
  });

  const store = new DecisionStore(options?.storeOptions);

  registerRecordDecision(suite.server, store, suite.eventBus);
  registerListDecisions(suite.server, store);
  registerGetDecision(suite.server, store);
  registerSupersedeDecision(suite.server, store, suite.eventBus);
  registerLinkDecision(suite.server, store);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All decision-log tools registered');
  return suite;
}
