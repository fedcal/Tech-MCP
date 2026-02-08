/**
 * Tool: check-vulnerabilities
 * Reads a project's package.json, runs `npm audit --json`, and returns
 * a vulnerability report grouped by severity.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { EventBus } from '@mcp-suite/core';
import type { DependencyStore } from '../services/dependency-store.js';

interface Vulnerability {
  name: string;
  severity: string;
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean | { name: string; version: string };
}

interface AuditReport {
  totalVulnerabilities: number;
  severityCounts: Record<string, number>;
  vulnerabilities: Record<string, Vulnerability[]>;
}

export function registerCheckVulnerabilities(server: McpServer, store: DependencyStore, eventBus?: EventBus): void {
  server.tool(
    'check-vulnerabilities',
    'Run npm audit on a project and return vulnerabilities grouped by severity',
    {
      projectPath: z.string().describe('Absolute path to the project directory containing package.json'),
    },
    async ({ projectPath }) => {
      try {
        const packageJsonPath = join(projectPath, 'package.json');
        if (!existsSync(packageJsonPath)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No package.json found at ${packageJsonPath}`,
              },
            ],
            isError: true,
          };
        }

        // Verify package.json is valid
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const projectName = packageJson.name || 'unknown';

        let auditOutput: string;
        try {
          // npm audit returns non-zero exit code when vulnerabilities are found,
          // so we catch the error and still use the stdout
          auditOutput = execSync('npm audit --json', {
            cwd: projectPath,
            encoding: 'utf-8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } catch (error: unknown) {
          // npm audit exits with non-zero when vulnerabilities exist
          const execError = error as { stdout?: string; stderr?: string };
          if (execError.stdout) {
            auditOutput = execError.stdout;
          } else {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Failed to run npm audit: ${execError.stderr || String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        const auditData = JSON.parse(auditOutput);

        // Parse the audit results into a structured report
        const report: AuditReport = {
          totalVulnerabilities: 0,
          severityCounts: {},
          vulnerabilities: {},
        };

        // npm audit --json v7+ format uses "vulnerabilities" object
        if (auditData.vulnerabilities) {
          for (const [name, details] of Object.entries(auditData.vulnerabilities)) {
            const vuln = details as {
              severity: string;
              via: Array<{ title?: string; url?: string; severity?: string } | string>;
              range: string;
              fixAvailable: boolean | { name: string; version: string };
            };

            const severity = vuln.severity || 'unknown';

            if (!report.vulnerabilities[severity]) {
              report.vulnerabilities[severity] = [];
            }

            // Extract title and URL from the first "via" entry that is an object
            let title = 'No description available';
            let url = '';
            for (const via of vuln.via) {
              if (typeof via === 'object' && via.title) {
                title = via.title;
                url = via.url || '';
                break;
              }
            }

            report.vulnerabilities[severity].push({
              name,
              severity,
              title,
              url,
              range: vuln.range || '*',
              fixAvailable: vuln.fixAvailable ?? false,
            });

            report.severityCounts[severity] = (report.severityCounts[severity] || 0) + 1;
            report.totalVulnerabilities++;
          }
        }

        // Also include metadata from audit if available
        const metadata = auditData.metadata || {};

        const result = {
          project: projectName,
          projectPath,
          totalVulnerabilities: report.totalVulnerabilities,
          severityCounts: report.severityCounts,
          vulnerabilities: report.vulnerabilities,
          metadata: {
            totalDependencies: metadata.totalDependencies || 0,
            devDependencies: metadata.devDependencies || 0,
            prodDependencies: metadata.prodDependencies || 0,
          },
        };

        // Persist the scan result
        store.saveScan({
          projectPath,
          vulnerabilityCount: report.totalVulnerabilities,
          criticalCount: report.severityCounts['critical'] || 0,
          highCount: report.severityCounts['high'] || 0,
          results: JSON.stringify(result),
        });

        // Publish dependency-alert for each critical/high vulnerability
        for (const severity of ['critical', 'high'] as const) {
          const vulns = report.vulnerabilities[severity] || [];
          for (const vuln of vulns) {
            eventBus?.publish('code:dependency-alert', {
              package: vuln.name,
              severity,
              advisory: vuln.title,
            });
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error checking vulnerabilities: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
