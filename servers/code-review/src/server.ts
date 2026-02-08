/**
 * Code Review MCP Server
 * Tools for analyzing diffs, checking complexity, and suggesting code improvements.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ReviewStore } from './services/review-store.js';
import { registerAnalyzeDiff } from './tools/analyze-diff.js';
import { registerCheckComplexity } from './tools/check-complexity.js';
import { registerSuggestImprovements } from './tools/suggest-improvements.js';

export function createCodeReviewServer(options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } }): McpSuiteServer {
  const suite = createMcpServer({
    name: 'code-review',
    version: '0.1.0',
    description: 'MCP server for code review: analyzing diffs, checking complexity, and suggesting improvements',
    eventBus: options?.eventBus,
  });

  const store = new ReviewStore(options?.storeOptions);

  // Register all tools
  registerAnalyzeDiff(suite.server, store, suite.eventBus);
  registerCheckComplexity(suite.server, store);
  registerSuggestImprovements(suite.server, store, suite.eventBus);

  suite.logger.info('All code-review tools registered');

  return suite;
}
