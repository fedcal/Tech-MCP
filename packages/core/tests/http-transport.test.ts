import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createMcpServer, startHttpServer } from '../src/server-factory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpSuiteServer } from '../src/server-factory.js';
import { z } from 'zod';

let suite: McpSuiteServer | undefined;

afterEach(async () => {
  if (suite?.httpServer) {
    suite.httpServer.close();
  }
  suite = undefined;
});

describe('startHttpServer', () => {
  it('should start HTTP server and respond to health check', async () => {
    suite = createMcpServer({
      name: 'test-http',
      version: '1.0.0',
      config: { transport: 'http', port: 0 },
    });

    await startHttpServer(suite);

    expect(suite.httpServer).toBeDefined();
    expect(suite.httpServer!.listening).toBe(true);

    const port = (suite.httpServer!.address() as AddressInfo).port;
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.server).toBe('test-http');
  });

  it('should handle tool calls over HTTP transport', async () => {
    suite = createMcpServer({
      name: 'test-http-tools',
      version: '1.0.0',
      config: { transport: 'http', port: 0 },
    });

    // Register a simple test tool
    suite.server.tool('echo', 'Echoes the input', { message: z.string() }, async ({ message }) => ({
      content: [{ type: 'text' as const, text: `Echo: ${message}` }],
    }));

    await startHttpServer(suite);

    const port = (suite.httpServer!.address() as AddressInfo).port;
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
    );

    await client.connect(transport);

    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toBe('Echo: hello');

    await client.close();
  });

  it('should list tools over HTTP transport', async () => {
    suite = createMcpServer({
      name: 'test-list',
      version: '1.0.0',
      config: { transport: 'http', port: 0 },
    });

    suite.server.tool('my-tool', 'A test tool', {}, async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    }));

    await startHttpServer(suite);

    const port = (suite.httpServer!.address() as AddressInfo).port;
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
    );
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.length).toBe(1);
    expect(tools.tools[0].name).toBe('my-tool');

    await client.close();
  });
});
