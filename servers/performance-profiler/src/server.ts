/**
 * Performance Profiler MCP Server
 * Tools for analyzing bundle size, finding performance bottlenecks, and benchmarking code.
 */

import { createMcpServer, type McpSuiteServer, type EventBus } from '@mcp-suite/core';
import { ProfilerStore } from './services/profiler-store.js';
import { registerAnalyzeBundle } from './tools/analyze-bundle.js';
import { registerFindBottlenecks } from './tools/find-bottlenecks.js';
import { registerBenchmarkCompare } from './tools/benchmark-compare.js';

export function createPerformanceProfilerServer(options?: {
  eventBus?: EventBus;
  storeOptions?: { inMemory?: boolean };
}): McpSuiteServer {
  const store = new ProfilerStore(options?.storeOptions);

  const suite = createMcpServer({
    name: 'performance-profiler',
    version: '0.1.0',
    description: 'MCP server for analyzing performance, bundle sizes, and benchmarking code',
    eventBus: options?.eventBus,
  });

  // Register all tools
  registerAnalyzeBundle(suite.server, store);
  registerFindBottlenecks(suite.server, suite.eventBus, store);
  registerBenchmarkCompare(suite.server, suite.eventBus, store);

  suite.logger.info('All performance-profiler tools registered');

  return suite;
}
