/**
 * API Documentation MCP Server
 * Tools for extracting, generating, and analyzing API documentation.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { DocsStore } from './services/docs-store.js';
import { registerExtractEndpoints } from './tools/extract-endpoints.js';
import { registerGenerateOpenapi } from './tools/generate-openapi.js';
import { registerFindUndocumented } from './tools/find-undocumented.js';

export function createApiDocumentationServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'api-documentation',
    version: '0.1.0',
    description: 'MCP server for extracting, generating, and analyzing API documentation',
    eventBus: options?.eventBus,
  });

  const store = new DocsStore(options?.storeOptions);

  // Register all tools
  registerExtractEndpoints(suite.server, store, suite.eventBus);
  registerGenerateOpenapi(suite.server, store);
  registerFindUndocumented(suite.server, store, suite.eventBus);

  suite.logger.info('All api-documentation tools registered');

  return suite;
}
