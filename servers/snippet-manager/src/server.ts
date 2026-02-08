/**
 * Snippet Manager MCP Server
 * Tools for saving, searching, retrieving, deleting, and tagging code snippets.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { SnippetStore } from './services/snippet-store.js';
import { registerSaveSnippet } from './tools/save-snippet.js';
import { registerSearchSnippets } from './tools/search-snippets.js';
import { registerGetSnippet } from './tools/get-snippet.js';
import { registerDeleteSnippet } from './tools/delete-snippet.js';
import { registerListTags } from './tools/list-tags.js';

export function createSnippetManagerServer(options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } }): McpSuiteServer {
  const eventBus = options?.eventBus;
  const suite = createMcpServer({
    name: 'snippet-manager',
    version: '0.1.0',
    description: 'MCP server for managing reusable code snippets with SQLite storage',
    eventBus,
  });

  const store = new SnippetStore(options?.storeOptions);

  // Register all tools
  registerSaveSnippet(suite.server, store);
  registerSearchSnippets(suite.server, store);
  registerGetSnippet(suite.server, store);
  registerDeleteSnippet(suite.server, store);
  registerListTags(suite.server, store);

  suite.logger.info('All snippet-manager tools registered');

  return suite;
}
