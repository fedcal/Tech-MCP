/**
 * Tool: list-pipelines
 * Lists recent CI/CD pipeline (GitHub Actions workflow) runs using the GitHub CLI.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import type { CicdStore } from '../services/cicd-store.js';

export function registerListPipelines(server: McpServer, store: CicdStore): void {
  server.tool(
    'list-pipelines',
    'List recent GitHub Actions workflow runs for a repository',
    {
      repo: z
        .string()
        .optional()
        .describe('Repository in owner/repo format. Defaults to current repo.'),
      limit: z
        .number()
        .default(10)
        .describe('Maximum number of runs to return (default: 10)'),
    },
    async ({ repo, limit }) => {
      try {
        const repoFlag = repo ? ` -R ${repo}` : '';
        const fields =
          'databaseId,displayTitle,headBranch,event,status,conclusion,createdAt,updatedAt,url,workflowName';
        const cmd = `gh run list${repoFlag} --limit ${limit} --json ${fields}`;

        const output = execSync(cmd, {
          encoding: 'utf-8',
          timeout: 30_000,
        });

        const runs: Array<Record<string, unknown>> = JSON.parse(output);

        const summary = {
          total: runs.length,
          runs: runs.map((run) => ({
            id: run.databaseId,
            title: run.displayTitle,
            branch: run.headBranch,
            event: run.event,
            status: run.status,
            conclusion: run.conclusion,
            workflow: run.workflowName,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
            url: run.url,
          })),
        };

        // Persist each run to the store
        for (const run of summary.runs) {
          store.savePipelineRun({
            runId: String(run.id),
            repo: repo ?? undefined,
            branch: typeof run.branch === 'string' ? run.branch : undefined,
            status: String(run.status ?? 'unknown'),
            conclusion: typeof run.conclusion === 'string' ? run.conclusion : undefined,
            workflow: typeof run.workflow === 'string' ? run.workflow : undefined,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list pipeline runs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
