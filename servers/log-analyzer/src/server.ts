/**
 * Log Analyzer MCP Server
 * Tools for analyzing log files: parsing, pattern detection, tailing, and summarization.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { registerAnalyzeLogFile } from './tools/analyze-log-file.js';
import { registerFindErrorPatterns } from './tools/find-error-patterns.js';
import { registerTailLog } from './tools/tail-log.js';
import { registerGenerateSummary } from './tools/generate-summary.js';
import { LogStore } from './services/log-store.js';

export function createLogAnalyzerServer(
  options?: { eventBus?: EventBus; storeOptions?: { inMemory?: boolean } },
): McpSuiteServer {
  const suite = createMcpServer({
    name: 'log-analyzer',
    version: '0.1.0',
    description: 'MCP server for analyzing log files, finding error patterns, and generating summaries',
    eventBus: options?.eventBus,
  });

  const store = new LogStore(options?.storeOptions);

  // Register all tools
  registerAnalyzeLogFile(suite.server, store);
  registerFindErrorPatterns(suite.server, store);
  registerTailLog(suite.server, store);
  registerGenerateSummary(suite.server, store);

  suite.logger.info('All log-analyzer tools registered');

  return suite;
}
