/**
 * MCP Client pool for server-to-server communication.
 * Enables servers to call tools on other servers (synchronous request/response).
 * Supports STDIO, HTTP (Streamable HTTP), and InMemory transports.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Logger } from '@mcp-suite/core';

export interface ServerRegistryEntry {
  name: string;
  transport: 'stdio' | 'http' | 'in-memory';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export class McpClientManager {
  private clients = new Map<string, Client>();
  private transports = new Map<string, Transport>();
  private registry = new Map<string, ServerRegistryEntry>();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('client-manager');
  }

  register(entry: ServerRegistryEntry): void {
    this.registry.set(entry.name, entry);
    this.logger.debug(`Registered server: ${entry.name}`);
  }

  registerMany(entries: ServerRegistryEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  async getClient(serverName: string): Promise<Client> {
    const existing = this.clients.get(serverName);
    if (existing) return existing;

    const entry = this.registry.get(serverName);
    if (!entry) {
      throw new Error(`Server '${serverName}' not registered in client manager`);
    }

    switch (entry.transport) {
      case 'stdio':
        return this.connectStdio(entry);
      case 'http':
        return this.connectHttp(entry);
      case 'in-memory':
        throw new Error(
          `In-memory transport for '${entry.name}' must be connected via connectInMemory()`,
        );
    }
  }

  private async connectStdio(entry: ServerRegistryEntry): Promise<Client> {
    if (!entry.command) {
      throw new Error(`STDIO transport requires 'command' for server '${entry.name}'`);
    }

    const transport = new StdioClientTransport({
      command: entry.command,
      args: entry.args,
      env: entry.env,
    });

    const client = new Client({
      name: `mcp-suite-client-for-${entry.name}`,
      version: '1.0.0',
    });

    await client.connect(transport);
    this.clients.set(entry.name, client);
    this.transports.set(entry.name, transport);
    this.logger.info(`Connected to server via STDIO: ${entry.name}`);

    return client;
  }

  private async connectHttp(entry: ServerRegistryEntry): Promise<Client> {
    if (!entry.url) {
      throw new Error(`HTTP transport requires 'url' for server '${entry.name}'`);
    }

    const transport = new StreamableHTTPClientTransport(new URL(entry.url));

    const client = new Client({
      name: `mcp-suite-client-for-${entry.name}`,
      version: '1.0.0',
    });

    await client.connect(transport);
    this.clients.set(entry.name, client);
    this.transports.set(entry.name, transport);
    this.logger.info(`Connected to server via HTTP: ${entry.name} at ${entry.url}`);

    return client;
  }

  /**
   * Create an InMemoryTransport linked pair for in-process server-to-server communication.
   * Returns [clientTransport, serverTransport].
   * Usage:
   *   1. const [ct, st] = McpClientManager.createInMemoryPair();
   *   2. await targetServer.connect(st);   // server side first
   *   3. await clientManager.connectInMemoryWithTransport('name', ct);  // then client
   */
  static createInMemoryPair(): [Transport, Transport] {
    return InMemoryTransport.createLinkedPair();
  }

  /**
   * Connect to a server using a pre-created InMemoryTransport (client side).
   * The server must already be connected to the paired server transport.
   */
  async connectInMemoryWithTransport(serverName: string, clientTransport: Transport): Promise<void> {
    const client = new Client({
      name: `mcp-suite-client-for-${serverName}`,
      version: '1.0.0',
    });

    await client.connect(clientTransport);
    this.clients.set(serverName, client);
    this.transports.set(serverName, clientTransport);
    this.logger.info(`Connected to server in-memory: ${serverName}`);
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const client = await this.getClient(serverName);
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  }

  async readResource(serverName: string, uri: string): Promise<unknown> {
    const client = await this.getClient(serverName);
    const result = await client.readResource({ uri });
    return result;
  }

  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
    }
    const transport = this.transports.get(serverName);
    if (transport) {
      await transport.close();
      this.transports.delete(serverName);
    }
    this.logger.info(`Disconnected from server: ${serverName}`);
  }

  async disconnectAll(): Promise<void> {
    const names = [...this.clients.keys()];
    await Promise.all(names.map((name) => this.disconnect(name)));
  }

  getRegisteredServers(): string[] {
    return [...this.registry.keys()];
  }

  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }
}
