/**
 * Data Mock Generator MCP Server
 * Tools for generating realistic mock data in various formats.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import type { McpClientManager } from '@mcp-suite/client-manager';
import { MockStore } from './services/mock-store.js';
import { registerGenerateMockData } from './tools/generate-mock-data.js';
import { registerGenerateJson } from './tools/generate-json.js';
import { registerGenerateCsv } from './tools/generate-csv.js';
import { registerListGenerators } from './tools/list-generators.js';

export function createDataMockGeneratorServer(
  options?: { eventBus?: EventBus; clientManager?: McpClientManager; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'data-mock-generator',
    version: '0.1.0',
    description: 'MCP server for generating realistic mock data in JSON, CSV, and other formats',
    eventBus: options?.eventBus,
  });

  const store = new MockStore(options?.storeOptions);

  // Register all tools
  registerGenerateMockData(suite.server, store, options?.clientManager);
  registerGenerateJson(suite.server, store);
  registerGenerateCsv(suite.server, store);
  registerListGenerators(suite.server);

  suite.logger.info('All data-mock-generator tools registered');

  return suite;
}
