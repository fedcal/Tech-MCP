import { describe, it, expect, afterEach } from 'vitest';
import { McpClientManager } from '../src/manager.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMcpServer, startHttpServer } from '@mcp-suite/core';

let httpServer: Server | undefined;
let clientManager: McpClientManager | undefined;

afterEach(async () => {
  if (clientManager) {
    await clientManager.disconnectAll();
    clientManager = undefined;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = undefined;
  }
});

describe('McpClientManager', () => {
  describe('connectInMemory', () => {
    it('should connect to a server via InMemoryTransport and call tools', async () => {
      clientManager = new McpClientManager();

      // Create a test MCP server with a tool
      const server = new McpServer({ name: 'test-server', version: '1.0.0' });
      server.tool('greet', 'Greet someone', { name: z.string() }, async ({ name }) => ({
        content: [{ type: 'text' as const, text: `Hello, ${name}!` }],
      }));

      // Connect in-memory: server must connect before client
      const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
      await server.connect(serverTransport);
      await clientManager.connectInMemoryWithTransport('test-server', clientTransport);

      // Call the tool
      const result = await clientManager.callTool('test-server', 'greet', { name: 'World' });
      const content = (result as { content: Array<{ text: string }> }).content;
      expect(content[0].text).toBe('Hello, World!');
      expect(clientManager.isConnected('test-server')).toBe(true);
    });

    it('should disconnect cleanly', async () => {
      clientManager = new McpClientManager();
      const server = new McpServer({ name: 'test', version: '1.0.0' });

      const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
      await server.connect(serverTransport);
      await clientManager.connectInMemoryWithTransport('test', clientTransport);

      expect(clientManager.isConnected('test')).toBe(true);
      await clientManager.disconnect('test');
      expect(clientManager.isConnected('test')).toBe(false);
    });
  });

  describe('connectHttp', () => {
    it('should connect to a server via HTTP and call tools', async () => {
      // Start an HTTP server
      const suite = createMcpServer({
        name: 'http-test',
        version: '1.0.0',
        config: { transport: 'http', port: 0 },
      });
      suite.server.tool('add', 'Add numbers', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
        content: [{ type: 'text' as const, text: String(a + b) }],
      }));
      await startHttpServer(suite);
      httpServer = suite.httpServer;

      const port = (suite.httpServer!.address() as AddressInfo).port;

      // Connect via ClientManager
      clientManager = new McpClientManager();
      clientManager.register({
        name: 'http-test',
        transport: 'http',
        url: `http://localhost:${port}/mcp`,
      });

      const result = await clientManager.callTool('http-test', 'add', { a: 3, b: 7 });
      const content = (result as { content: Array<{ text: string }> }).content;
      expect(content[0].text).toBe('10');
    });
  });

  describe('registry', () => {
    it('should register and list servers', () => {
      clientManager = new McpClientManager();
      clientManager.registerMany([
        { name: 'server-a', transport: 'http', url: 'http://localhost:3001/mcp' },
        { name: 'server-b', transport: 'http', url: 'http://localhost:3002/mcp' },
      ]);
      expect(clientManager.getRegisteredServers()).toEqual(['server-a', 'server-b']);
    });

    it('should throw for unregistered server', async () => {
      clientManager = new McpClientManager();
      await expect(clientManager.getClient('unknown')).rejects.toThrow(
        "Server 'unknown' not registered",
      );
    });
  });
});
