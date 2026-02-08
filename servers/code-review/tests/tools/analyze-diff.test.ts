import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestHarness, type TestHarness, MockEventBus } from '@mcp-suite/testing';
import { createCodeReviewServer } from '../../src/server.js';

describe('analyze-diff', () => {
  let harness: TestHarness;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    const suite = createCodeReviewServer({ eventBus, storeOptions: { inMemory: true } });
    harness = await createTestHarness(suite.server);
  });

  afterEach(async () => {
    await harness.close();
  });

  const sampleDiff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,6 +10,8 @@ function main() {
   const config = loadConfig();
+  console.log('Debug: config loaded', config);
+  // TODO: Remove this debug log before release
   return startServer(config);
 }`;

  const cleanDiff = `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,5 @@
+export function add(a: number, b: number): number {
+  return a + b;
 }`;

  it('should analyze a diff and return valid result with stats', async () => {
    const result = await harness.client.callTool({
      name: 'analyze-diff',
      arguments: { diff: sampleDiff },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const parsed = JSON.parse(content[0].text);

    // Stats
    expect(parsed.stats).toBeDefined();
    expect(parsed.stats.filesChanged).toBe(1);
    expect(parsed.stats.linesAdded).toBeGreaterThan(0);

    // Files
    expect(parsed.files).toBeDefined();
    expect(parsed.files).toContain('src/app.ts');

    // Issues detected
    expect(parsed.totalIssues).toBeGreaterThan(0);
    expect(parsed.issues).toBeDefined();
    expect(Array.isArray(parsed.issues)).toBe(true);

    // Should detect console.log and TODO
    expect(parsed.issuesByType['console-statement']).toBeGreaterThanOrEqual(1);
    expect(parsed.issuesByType['todo-comment']).toBeGreaterThanOrEqual(1);

    // Severity breakdown
    expect(parsed.issuesBySeverity).toBeDefined();
    expect(typeof parsed.issuesBySeverity.warning).toBe('number');
    expect(typeof parsed.issuesBySeverity.info).toBe('number');
  });

  it('should return zero issues for a clean diff', async () => {
    const result = await harness.client.callTool({
      name: 'analyze-diff',
      arguments: { diff: cleanDiff },
    });

    const parsed = JSON.parse(
      (result.content as Array<{ text: string }>)[0].text,
    );

    expect(parsed.totalIssues).toBe(0);
    expect(parsed.issues).toEqual([]);
  });

  it('should publish code:commit-analyzed event', async () => {
    await harness.client.callTool({
      name: 'analyze-diff',
      arguments: { diff: sampleDiff },
    });

    expect(eventBus.wasPublished('code:commit-analyzed')).toBe(true);

    const events = eventBus.getPublishedEvents('code:commit-analyzed');
    expect(events).toHaveLength(1);

    const payload = events[0].payload as {
      commitHash: string;
      files: string[];
      stats: {
        filesChanged: number;
        linesAdded: number;
        linesRemoved: number;
      };
    };
    expect(payload.files).toContain('src/app.ts');
    expect(payload.stats.filesChanged).toBe(1);
    expect(payload.stats.linesAdded).toBeGreaterThan(0);
  });

  it('should detect hardcoded credentials', async () => {
    const credentialDiff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
+const apikey = "sk-1234567890abcdef";
 export default {};`;

    const result = await harness.client.callTool({
      name: 'analyze-diff',
      arguments: { diff: credentialDiff },
    });

    const parsed = JSON.parse(
      (result.content as Array<{ text: string }>)[0].text,
    );

    expect(parsed.issuesByType['hardcoded-credential']).toBeGreaterThanOrEqual(1);
    const credIssue = parsed.issues.find(
      (i: { type: string }) => i.type === 'hardcoded-credential',
    );
    expect(credIssue).toBeDefined();
    expect(credIssue.severity).toBe('error');
  });

  it('should detect debugger statements', async () => {
    const debuggerDiff = `diff --git a/src/handler.ts b/src/handler.ts
--- a/src/handler.ts
+++ b/src/handler.ts
@@ -5,3 +5,5 @@ function handle(req) {
+  debugger;
+  const result = process(req);
   return result;
 }`;

    const result = await harness.client.callTool({
      name: 'analyze-diff',
      arguments: { diff: debuggerDiff },
    });

    const parsed = JSON.parse(
      (result.content as Array<{ text: string }>)[0].text,
    );

    expect(parsed.issuesByType['debugger-statement']).toBeGreaterThanOrEqual(1);
    const debugIssue = parsed.issues.find(
      (i: { type: string }) => i.type === 'debugger-statement',
    );
    expect(debugIssue).toBeDefined();
    expect(debugIssue.severity).toBe('error');
  });
});
