/**
 * Codebase Knowledge MCP Server
 * Tools for searching, analyzing, and understanding codebases.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { KnowledgeStore } from './services/knowledge-store.js';
import { registerSearchCode } from './tools/search-code.js';
import { registerExplainModule } from './tools/explain-module.js';
import { registerArchitectureMap } from './tools/architecture-map.js';
import { registerDependencyGraph } from './tools/dependency-graph.js';
import { registerTrackChanges } from './tools/track-changes.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createCodebaseKnowledgeServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const suite = createMcpServer({
    name: 'codebase-knowledge',
    version: '0.1.0',
    description: 'MCP server for searching, analyzing, and understanding codebases',
    eventBus: options?.eventBus,
  });

  const store = new KnowledgeStore(options?.storeOptions);

  // Register all tools
  registerSearchCode(suite.server, store);
  registerExplainModule(suite.server, store);
  registerArchitectureMap(suite.server);
  registerDependencyGraph(suite.server);
  registerTrackChanges(suite.server, store, suite.eventBus);

  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All codebase-knowledge tools registered');

  return suite;
}
