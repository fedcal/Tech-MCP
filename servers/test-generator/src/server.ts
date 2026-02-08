/**
 * Test Generator MCP Server
 * Tools for generating unit test skeletons, finding edge cases, and analyzing test coverage.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { TestGenStore } from './services/test-gen-store.js';
import { registerGenerateUnitTests } from './tools/generate-unit-tests.js';
import { registerFindEdgeCases } from './tools/find-edge-cases.js';
import { registerAnalyzeCoverage } from './tools/analyze-coverage.js';

export function createTestGeneratorServer(options?: {
  eventBus?: EventBus;
  clientManager?: McpClientManager;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'test-generator',
    version: '0.1.0',
    description: 'MCP server for generating unit tests, finding edge cases, and analyzing coverage',
    eventBus: options?.eventBus,
  });

  const store = new TestGenStore(options?.storeOptions);

  // Register all tools
  registerGenerateUnitTests(suite.server, store, suite.eventBus, options?.clientManager);
  registerFindEdgeCases(suite.server, store);
  registerAnalyzeCoverage(suite.server, store, suite.eventBus);

  suite.logger.info('All test-generator tools registered');

  return suite;
}
