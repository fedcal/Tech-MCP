/**
 * Retrospective Manager MCP Server
 * Tools for running retrospectives, collecting feedback, voting, and generating action items.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { RetroStore } from './services/retro-store.js';
import { registerCreateRetro } from './tools/create-retro.js';
import { registerAddItem } from './tools/add-item.js';
import { registerVoteItem } from './tools/vote-item.js';
import { registerGenerateActionItems } from './tools/generate-action-items.js';
import { registerGetRetro } from './tools/get-retro.js';
import { registerDetectPatterns } from './tools/detect-patterns.js';
import { registerSuggestItems } from './tools/suggest-items.js';
import { setupCollaborationHandlers } from './collaboration.js';

export function createRetrospectiveManagerServer(options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } }): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'retrospective-manager',
    version: '0.1.0',
    description: 'MCP server for running retrospectives, collecting feedback, voting, and generating action items',
    eventBus,
  });

  const store = new RetroStore(options?.storeOptions?.inMemory);

  // Register all tools
  registerCreateRetro(suite.server, store);
  registerAddItem(suite.server, store);
  registerVoteItem(suite.server, store);
  registerGenerateActionItems(suite.server, store, suite.eventBus);
  registerGetRetro(suite.server, store);
  registerDetectPatterns(suite.server, store, suite.eventBus);
  registerSuggestItems(suite.server, store);

  // Setup cross-server collaboration handlers
  if (suite.eventBus) {
    setupCollaborationHandlers(suite.eventBus, store);
  }

  suite.logger.info('All retrospective-manager tools registered');

  return suite;
}
