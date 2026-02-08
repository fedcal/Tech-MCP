/**
 * DB Schema Explorer MCP Server
 * Tools for exploring SQLite database schemas, describing tables, suggesting indexes, and generating ERDs.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ExplorerStore } from './services/explorer-store.js';
import { registerExploreSchema } from './tools/explore-schema.js';
import { registerDescribeTable } from './tools/describe-table.js';
import { registerSuggestIndexes } from './tools/suggest-indexes.js';
import { registerGenerateErd } from './tools/generate-erd.js';

export function createDbSchemaExplorerServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'db-schema-explorer',
    version: '0.1.0',
    description: 'MCP server for exploring SQLite database schemas',
    eventBus: options?.eventBus,
  });

  const store = new ExplorerStore(options?.storeOptions);

  // Register all tools
  registerExploreSchema(suite.server, store);
  registerDescribeTable(suite.server, store);
  registerSuggestIndexes(suite.server, suite.eventBus, store);
  registerGenerateErd(suite.server, store);

  suite.logger.info('All db-schema-explorer tools registered');

  return suite;
}
