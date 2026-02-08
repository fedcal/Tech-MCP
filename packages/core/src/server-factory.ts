/**
 * Standardized MCP server creation factory.
 * Every MCP Suite server uses this factory to create and start servers.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '@mcp-suite/event-bus';
import { Logger } from './logger.js';
import { loadConfig, type ServerConfig } from './config.js';

export interface CreateServerOptions {
  name: string;
  version: string;
  description?: string;
  config?: Partial<ServerConfig>;
  eventBus?: EventBus;
}

export interface McpSuiteServer {
  name: string;
  server: McpServer;
  config: ServerConfig;
  logger: Logger;
  eventBus?: EventBus;
  httpServer?: Server;
}

export function createMcpServer(options: CreateServerOptions): McpSuiteServer {
  const config = loadConfig(options.name, options.config);
  const logger = new Logger(options.name, config.logLevel);

  logger.info(`Initializing ${options.name} v${options.version}`);

  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  return { name: options.name, server, config, logger, eventBus: options.eventBus };
}

export async function startStdioServer(suite: McpSuiteServer): Promise<void> {
  const transport = new StdioServerTransport();
  suite.logger.info('Starting server with STDIO transport');
  await suite.server.connect(transport);
}

export async function startHttpServer(suite: McpSuiteServer): Promise<void> {
  const port = suite.config.port ?? 3000;
  const app = createMcpExpressApp();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await suite.server.connect(transport);

  app.post('/mcp', async (req: IncomingMessage, res: ServerResponse) => {
    await transport.handleRequest(req, res, (req as unknown as { body?: unknown }).body);
  });

  app.get('/mcp', async (req: IncomingMessage, res: ServerResponse) => {
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', async (req: IncomingMessage, res: ServerResponse) => {
    await transport.handleRequest(req, res);
  });

  app.get('/health', (_req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', server: suite.name }));
  });

  await new Promise<void>((resolve) => {
    suite.httpServer = app.listen(port, () => {
      suite.logger.info(`HTTP server listening on port ${port}`);
      resolve();
    });
  });
}

export async function startServer(suite: McpSuiteServer): Promise<void> {
  if (suite.config.transport === 'http') {
    await startHttpServer(suite);
  } else {
    await startStdioServer(suite);
  }
}
