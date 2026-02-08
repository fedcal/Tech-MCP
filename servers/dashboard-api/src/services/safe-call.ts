/**
 * Utility for cross-server calls with graceful degradation.
 * Returns null if clientManager is unavailable or the call fails.
 */

import type { McpClientManager } from '@mcp-suite/client-manager';

export async function safeCall(
  clientManager: McpClientManager | undefined,
  server: string,
  tool: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown> | null> {
  if (!clientManager) return null;
  try {
    const result = await clientManager.callTool(server, tool, args);
    const content = (result as { content: Array<{ type: string; text: string }> }).content;
    return JSON.parse(content[0].text);
  } catch {
    return null;
  }
}
