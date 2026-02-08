/**
 * HTTP Client MCP Server
 * Tools for sending HTTP requests, comparing responses, and generating curl commands.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { HttpStore } from './services/http-store.js';
import { registerSendRequest } from './tools/send-request.js';
import { registerCompareResponses } from './tools/compare-responses.js';
import { registerGenerateCurl } from './tools/generate-curl.js';

export function createHttpClientServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'http-client',
    version: '0.1.0',
    description: 'MCP server for sending HTTP requests, comparing responses, and generating curl commands',
    eventBus: options?.eventBus,
  });

  const store = new HttpStore(options?.storeOptions);

  // Register all tools
  registerSendRequest(suite.server, store);
  registerCompareResponses(suite.server, store);
  registerGenerateCurl(suite.server, store);

  suite.logger.info('All http-client tools registered');

  return suite;
}
