/**
 * Integration test: data-mock-generator → db-schema-explorer (explore-schema)
 * Verifies that generate-mock-data can auto-detect schema from a SQLite DB via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createDataMockGeneratorServer } from '../../src/server.js';
import { createDbSchemaExplorerServer } from '../../../db-schema-explorer/src/server.js';

describe('generate-mock-data → db-schema-explorer wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;
  let tempDbPath: string;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('should generate mock data from database schema via db-schema-explorer', async () => {
    // 1. Create a temporary SQLite database with a known schema
    tempDbPath = path.join(os.tmpdir(), `mcp-test-${Date.now()}.db`);
    const db = new Database(tempDbPath);
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        active BOOLEAN DEFAULT 1
      );
    `);
    db.close();

    // 2. Create target server (db-schema-explorer)
    const targetSuite = createDbSchemaExplorerServer({ storeOptions: { inMemory: true } });

    // 3. Wire target server to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('db-schema-explorer', clientTransport);

    // 4. Create caller server (data-mock-generator) with clientManager
    const callerSuite = createDataMockGeneratorServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 5. Call generate-mock-data with dbPath
    const result = await callerHarness.client.callTool({
      name: 'generate-mock-data',
      arguments: {
        dbPath: tempDbPath,
        tableName: 'users',
        count: 5,
        name: 'users-mock',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');

    const rows = JSON.parse(content[0].text);
    expect(rows).toHaveLength(5);

    // Should have fields matching the table columns (except id which is primary key)
    const firstRow = rows[0];
    expect(firstRow).toHaveProperty('name');
    expect(firstRow).toHaveProperty('email');
    expect(firstRow).toHaveProperty('age');
    expect(firstRow).toHaveProperty('active');
    // id should be excluded (auto-increment primary key)
    expect(firstRow).not.toHaveProperty('id');
  });
});
