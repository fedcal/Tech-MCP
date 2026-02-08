/**
 * Factory for the Quality Gate MCP server.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { GateStore } from './services/gate-store.js';
import { registerDefineGate } from './tools/define-gate.js';
import { registerEvaluateGate } from './tools/evaluate-gate.js';
import { registerListGates } from './tools/list-gates.js';
import { registerGetGateHistory } from './tools/get-gate-history.js';
import { setupCollaboration } from './collaboration.js';

export function createQualityGateServer(
  options?: {
    eventBus?: EventBus;
    storeOptions?: { inMemory?: boolean };
  },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'quality-gate',
    version: '0.1.0',
    description: 'MCP server for Quality Gate definitions and evaluations',
    eventBus: options?.eventBus,
  });

  const store = new GateStore(options?.storeOptions);

  registerDefineGate(suite.server, store, suite.eventBus);
  registerEvaluateGate(suite.server, store, suite.eventBus);
  registerListGates(suite.server, store);
  registerGetGateHistory(suite.server, store);

  if (suite.eventBus) {
    setupCollaboration(suite.eventBus);
  }

  suite.logger.info('All quality-gate tools registered');
  return suite;
}
