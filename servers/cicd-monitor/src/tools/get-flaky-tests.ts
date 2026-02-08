/**
 * Tool: get-flaky-tests
 * Analyzes recent pipeline runs to identify flaky tests by finding
 * tests that pass/fail intermittently on the same branch.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import type { CicdStore } from '../services/cicd-store.js';

interface RunInfo {
  databaseId: number;
  headBranch: string;
  conclusion: string;
  workflowName: string;
  createdAt: string;
}

interface JobInfo {
  name: string;
  conclusion: string;
  steps: Array<{
    name: string;
    conclusion: string;
  }>;
}

interface StepRecord {
  passCount: number;
  failCount: number;
  totalRuns: number;
  job: string;
}

export function registerGetFlakyTests(server: McpServer, store: CicdStore): void {
  server.tool(
    'get-flaky-tests',
    'Analyze recent pipeline runs to find flaky tests that pass/fail intermittently on the same branch',
    {
      repo: z
        .string()
        .optional()
        .describe('Repository in owner/repo format. Defaults to current repo.'),
      branch: z
        .string()
        .optional()
        .describe('Branch to analyze. If omitted, analyzes all branches.'),
      runs: z
        .number()
        .default(20)
        .describe('Number of recent runs to analyze (default: 20)'),
    },
    async ({ repo, branch, runs }) => {
      try {
        const repoFlag = repo ? ` -R ${repo}` : '';
        const branchFlag = branch ? ` -b ${branch}` : '';
        const fields = 'databaseId,headBranch,conclusion,workflowName,createdAt';
        const listCmd = `gh run list${repoFlag}${branchFlag} --limit ${runs} --json ${fields}`;

        const listOutput = execSync(listCmd, {
          encoding: 'utf-8',
          timeout: 30_000,
        });

        const runsList: RunInfo[] = JSON.parse(listOutput);

        if (runsList.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ message: 'No runs found for analysis', flaky: [] }, null, 2),
              },
            ],
          };
        }

        // Group runs by branch + workflow
        const groupedRuns = new Map<string, RunInfo[]>();
        for (const run of runsList) {
          const key = `${run.headBranch}::${run.workflowName}`;
          const existing = groupedRuns.get(key) || [];
          existing.push(run);
          groupedRuns.set(key, existing);
        }

        // For each group with mixed results, drill into jobs/steps
        const stepStats = new Map<string, StepRecord>();

        for (const [groupKey, groupRuns] of groupedRuns) {
          const conclusions = new Set(groupRuns.map((r) => r.conclusion));
          // Only analyze groups that have mixed results (potential flakiness)
          if (conclusions.size <= 1) continue;

          // Sample up to 5 runs from each group to avoid too many API calls
          const sampled = groupRuns.slice(0, 5);

          for (const run of sampled) {
            try {
              const jobsCmd = `gh run view ${run.databaseId}${repoFlag} --json jobs`;
              const jobsOutput = execSync(jobsCmd, {
                encoding: 'utf-8',
                timeout: 30_000,
              });
              const jobsData: { jobs: JobInfo[] } = JSON.parse(jobsOutput);

              for (const job of jobsData.jobs || []) {
                for (const step of job.steps || []) {
                  const stepKey = `${groupKey}::${job.name}::${step.name}`;
                  const record = stepStats.get(stepKey) || {
                    passCount: 0,
                    failCount: 0,
                    totalRuns: 0,
                    job: job.name,
                  };

                  record.totalRuns++;
                  if (step.conclusion === 'success') {
                    record.passCount++;
                  } else if (step.conclusion === 'failure') {
                    record.failCount++;
                  }

                  stepStats.set(stepKey, record);
                }
              }
            } catch {
              // Skip runs we can't fetch details for
              continue;
            }
          }
        }

        // Identify flaky steps: those that both pass and fail
        const flakySteps: Array<{
          branch: string;
          workflow: string;
          job: string;
          step: string;
          passCount: number;
          failCount: number;
          totalRuns: number;
          flakinessRate: number;
        }> = [];

        for (const [stepKey, record] of stepStats) {
          if (record.passCount > 0 && record.failCount > 0) {
            const parts = stepKey.split('::');
            const branchName = parts[0];
            const workflowName = parts[1];
            const stepName = parts[3];

            const flakinessRate =
              Math.round(
                (Math.min(record.passCount, record.failCount) / record.totalRuns) * 100 * 100,
              ) / 100;

            flakySteps.push({
              branch: branchName,
              workflow: workflowName,
              job: record.job,
              step: stepName,
              passCount: record.passCount,
              failCount: record.failCount,
              totalRuns: record.totalRuns,
              flakinessRate,
            });
          }
        }

        // Sort by flakiness rate descending
        flakySteps.sort((a, b) => b.flakinessRate - a.flakinessRate);

        const result = {
          analyzedRuns: runsList.length,
          branchesAnalyzed: new Set(runsList.map((r) => r.headBranch)).size,
          flakyStepsFound: flakySteps.length,
          flaky: flakySteps,
        };

        // Persist each detected flaky test to the store
        for (const flaky of flakySteps) {
          store.saveFlakyTest({
            repo: repo ?? undefined,
            workflow: flaky.workflow,
            job: flaky.job,
            step: flaky.step,
            flakinessRate: flaky.flakinessRate,
            passCount: flaky.passCount,
            failCount: flaky.failCount,
          });
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to analyze flaky tests: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
