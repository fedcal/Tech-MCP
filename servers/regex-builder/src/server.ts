/**
 * Regex Builder MCP Server
 * Tools for building, testing, explaining, optimizing, and converting regex patterns.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { RegexStore } from './services/regex-store.js';
import { registerTestRegex } from './tools/test-regex.js';
import { registerExplainRegex } from './tools/explain-regex.js';
import { registerBuildRegex } from './tools/build-regex.js';
import { registerOptimizeRegex } from './tools/optimize-regex.js';
import { registerConvertRegex } from './tools/convert-regex.js';

export function createRegexBuilderServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'regex-builder',
    version: '0.1.0',
    description: 'MCP server for building, testing, and explaining regular expressions',
    eventBus: options?.eventBus,
  });

  const store = new RegexStore(options?.storeOptions);

  // Register all tools
  registerTestRegex(suite.server, store);
  registerExplainRegex(suite.server, store);
  registerBuildRegex(suite.server, store);
  registerOptimizeRegex(suite.server, store);
  registerConvertRegex(suite.server, store);

  suite.logger.info('All regex-builder tools registered');

  return suite;
}
