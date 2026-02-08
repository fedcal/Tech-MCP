/**
 * Tool: get-pipeline-status
 * Gets detailed status of a specific GitHub Actions workflow run.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import type { EventBus } from '@mcp-suite/core';
import type { CicdStore } from '../services/cicd-store.js';

interface JobStep {
  name: string;
  status: string;
  conclusion: string;
  number: number;
}

interface Job {
  name: string;
  status: string;
  conclusion: string;
  startedAt: string;
  completedAt: string;
  steps: JobStep[];
}

export function registerGetPipelineStatus(server: McpServer, eventBus?: EventBus, store?: CicdStore): void {
  server.tool(
    'get-pipeline-status',
    'Get detailed status of a specific GitHub Actions workflow run including jobs and steps',
    {
      runId: z.string().describe('The workflow run ID'),
      repo: z
        .string()
        .optional()
        .describe('Repository in owner/repo format. Defaults to current repo.'),
    },
    async ({ runId, repo }) => {
      try {
        const repoFlag = repo ? ` -R ${repo}` : '';
        const runFields =
          'databaseId,displayTitle,headBranch,headSha,event,status,conclusion,createdAt,updatedAt,url,workflowName';
        const runCmd = `gh run view ${runId}${repoFlag} --json ${runFields}`;

        const runOutput = execSync(runCmd, {
          encoding: 'utf-8',
          timeout: 30_000,
        });

        const run: Record<string, unknown> = JSON.parse(runOutput);

        // Fetch jobs for this run
        const jobsFields = 'name,status,conclusion,startedAt,completedAt,steps';
        const jobsCmd = `gh run view ${runId}${repoFlag} --json jobs`;

        const jobsOutput = execSync(jobsCmd, {
          encoding: 'utf-8',
          timeout: 30_000,
        });

        const jobsData: { jobs: Job[] } = JSON.parse(jobsOutput);

        const result = {
          id: run.databaseId,
          title: run.displayTitle,
          branch: run.headBranch,
          sha: run.headSha,
          event: run.event,
          status: run.status,
          conclusion: run.conclusion,
          workflow: run.workflowName,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          url: run.url,
          jobs: (jobsData.jobs || []).map((job) => ({
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            steps: (job.steps || []).map((step) => ({
              name: step.name,
              status: step.status,
              conclusion: step.conclusion,
              number: step.number,
            })),
          })),
        };

        // Publish pipeline-completed event
        const createdMs = run.createdAt ? new Date(run.createdAt as string).getTime() : 0;
        const updatedMs = run.updatedAt ? new Date(run.updatedAt as string).getTime() : 0;
        const duration = createdMs && updatedMs ? updatedMs - createdMs : 0;

        eventBus?.publish('cicd:pipeline-completed', {
          pipelineId: String(run.databaseId ?? runId),
          status: run.conclusion === 'failure' ? 'failed' : 'success',
          branch: String(run.headBranch ?? ''),
          duration,
        });

        // Publish build-failed event when conclusion is failure
        if (run.conclusion === 'failure') {
          const failedJob = (jobsData.jobs || []).find((j) => j.conclusion === 'failure');
          eventBus?.publish('cicd:build-failed', {
            pipelineId: String(run.databaseId ?? runId),
            error: failedJob ? `Job "${failedJob.name}" failed` : 'Build failed',
            stage: failedJob?.name ?? 'unknown',
            branch: String(run.headBranch ?? ''),
          });
        }

        // Persist pipeline run to the store
        store?.savePipelineRun({
          runId: String(run.databaseId ?? runId),
          repo: repo ?? undefined,
          branch: typeof run.headBranch === 'string' ? run.headBranch : undefined,
          status: String(run.status ?? 'unknown'),
          conclusion: typeof run.conclusion === 'string' ? run.conclusion : undefined,
          workflow: typeof run.workflowName === 'string' ? run.workflowName : undefined,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get pipeline status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
