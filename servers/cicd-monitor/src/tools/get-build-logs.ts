/**
 * Tool: get-build-logs
 * Gets logs for a specific GitHub Actions workflow run.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import type { CicdStore } from '../services/cicd-store.js';

export function registerGetBuildLogs(server: McpServer, store: CicdStore): void {
  server.tool(
    'get-build-logs',
    'Get logs (tail) for a specific GitHub Actions workflow run',
    {
      runId: z.string().describe('The workflow run ID'),
      repo: z
        .string()
        .optional()
        .describe('Repository in owner/repo format. Defaults to current repo.'),
      lines: z
        .number()
        .default(100)
        .describe('Number of lines to return from the end of the log (default: 100)'),
    },
    async ({ runId, repo, lines }) => {
      try {
        const repoFlag = repo ? ` -R ${repo}` : '';
        const cmd = `gh run view ${runId}${repoFlag} --log`;

        const output = execSync(cmd, {
          encoding: 'utf-8',
          timeout: 60_000,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large logs
        });

        // Take the last N lines
        const allLines = output.split('\n');
        const totalLines = allLines.length;
        const tailLines = allLines.slice(-lines).join('\n');

        const result = [
          `=== Build Logs for Run ${runId} ===`,
          `Total lines: ${totalLines}`,
          `Showing last ${Math.min(lines, totalLines)} lines:`,
          '',
          tailLines,
        ].join('\n');

        // Persist the pipeline run reference to the store
        store.savePipelineRun({
          runId,
          repo: repo ?? undefined,
          status: 'log_viewed',
        });

        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get build logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
