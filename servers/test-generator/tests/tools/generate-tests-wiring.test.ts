/**
 * Integration test: test-generator → codebase-knowledge (explain-module)
 * Verifies that generate-unit-tests can fetch module info from codebase-knowledge via ClientManager.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHarness, type TestHarness } from '@mcp-suite/testing';
import { McpClientManager } from '@mcp-suite/client-manager';
import { createTestGeneratorServer } from '../../src/server.js';
import { createCodebaseKnowledgeServer } from '../../../codebase-knowledge/src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('generate-unit-tests → codebase-knowledge wiring', () => {
  let callerHarness: TestHarness;
  let clientManager: McpClientManager;

  afterEach(async () => {
    if (callerHarness) await callerHarness.close();
    if (clientManager) await clientManager.disconnectAll();
  });

  it('should generate tests from file path using codebase-knowledge module analysis', async () => {
    // 1. Create target server (codebase-knowledge)
    const targetSuite = createCodebaseKnowledgeServer({ storeOptions: { inMemory: true } });

    // 2. Wire target server to clientManager
    clientManager = new McpClientManager();
    const [clientTransport, serverTransport] = McpClientManager.createInMemoryPair();
    await targetSuite.server.connect(serverTransport);
    await clientManager.connectInMemoryWithTransport('codebase-knowledge', clientTransport);

    // 3. Create caller server (test-generator) with clientManager
    const callerSuite = createTestGeneratorServer({
      clientManager,
      storeOptions: { inMemory: true },
    });
    callerHarness = await createTestHarness(callerSuite.server);

    // 4. Call generate-unit-tests with filePath pointing to a real source file
    // Use the core server-factory.ts as a test target (has exported functions)
    const targetFile = path.resolve(__dirname, '../../../../packages/core/src/server-factory.ts');

    const result = await callerHarness.client.callTool({
      name: 'generate-unit-tests',
      arguments: {
        filePath: targetFile,
        framework: 'vitest',
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');

    const testCode = content[0].text;
    // Should have generated test skeletons with function names found in the file
    expect(testCode).toContain('describe(');
    expect(testCode).toContain('it(');
  });
});
