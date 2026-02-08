/**
 * Tool: analyze-dockerfile
 * Analyze a Dockerfile for best practices and common issues.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { DockerStore } from '../services/docker-store.js';

interface DockerfileIssue {
  line: number;
  severity: 'warning' | 'error' | 'info';
  rule: string;
  message: string;
  suggestion: string;
}

interface DockerfileAnalysis {
  filePath: string;
  baseImage: string | null;
  stages: number;
  totalInstructions: number;
  issues: DockerfileIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

const LARGE_BASE_IMAGES = [
  'ubuntu',
  'debian',
  'centos',
  'fedora',
  'amazonlinux',
  'oraclelinux',
];

function analyzeDockerfileContent(filePath: string, content: string): DockerfileAnalysis {
  const lines = content.split('\n');
  const issues: DockerfileIssue[] = [];
  let baseImage: string | null = null;
  let stages = 0;
  let totalInstructions = 0;
  let hasHealthcheck = false;
  let hasUser = false;
  let consecutiveRunCommands: number[] = [];
  let lastWasRun = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      lastWasRun = false;
      continue;
    }

    // Skip continuation lines
    if (line.startsWith('&&') || line.startsWith('||') || line.startsWith('\\')) {
      continue;
    }

    const instruction = line.split(/\s+/)[0].toUpperCase();
    totalInstructions++;

    switch (instruction) {
      case 'FROM': {
        stages++;
        const fromParts = line.split(/\s+/);
        const image = fromParts[1] || '';
        if (stages === 1) {
          baseImage = image;
        }

        // Check for :latest tag
        if (image.endsWith(':latest')) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            rule: 'no-latest-tag',
            message: `Base image "${image}" uses the :latest tag.`,
            suggestion: 'Pin to a specific version tag for reproducible builds (e.g., node:20-alpine).',
          });
        } else if (!image.includes(':') && !image.includes('@') && image !== 'scratch') {
          issues.push({
            line: lineNum,
            severity: 'warning',
            rule: 'no-tag',
            message: `Base image "${image}" has no version tag specified (defaults to :latest).`,
            suggestion: 'Explicitly specify a version tag for reproducible builds.',
          });
        }

        // Check for large base images
        const imageName = image.split(':')[0].split('/').pop() || '';
        if (LARGE_BASE_IMAGES.includes(imageName.toLowerCase())) {
          issues.push({
            line: lineNum,
            severity: 'info',
            rule: 'large-base-image',
            message: `Base image "${image}" is a full-size distribution.`,
            suggestion: 'Consider using a slim or alpine variant to reduce image size (e.g., debian:bookworm-slim).',
          });
        }

        lastWasRun = false;
        break;
      }

      case 'RUN': {
        if (lastWasRun) {
          consecutiveRunCommands.push(lineNum);
        } else {
          // Flush previous consecutive runs
          if (consecutiveRunCommands.length > 0) {
            emitConsecutiveRunWarning(consecutiveRunCommands, issues);
          }
          consecutiveRunCommands = [lineNum];
        }
        lastWasRun = true;

        // Check for apt-get install without --no-install-recommends
        if (line.includes('apt-get install') && !line.includes('--no-install-recommends')) {
          issues.push({
            line: lineNum,
            severity: 'info',
            rule: 'apt-no-recommends',
            message: 'apt-get install without --no-install-recommends.',
            suggestion: 'Use --no-install-recommends to avoid installing unnecessary packages and reduce image size.',
          });
        }

        // Check for apt-get update without apt-get install in same RUN
        if (line.includes('apt-get update') && !line.includes('apt-get install')) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            rule: 'apt-update-alone',
            message: 'apt-get update without apt-get install in the same RUN instruction.',
            suggestion: 'Combine apt-get update and apt-get install in a single RUN to avoid cache issues.',
          });
        }

        // Check for curl/wget piped to shell
        if ((line.includes('curl') || line.includes('wget')) && line.includes('| sh')) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            rule: 'pipe-to-shell',
            message: 'Downloading and piping directly to shell.',
            suggestion: 'Download the script first, verify its contents/checksum, then execute it.',
          });
        }

        break;
      }

      case 'HEALTHCHECK': {
        hasHealthcheck = true;
        lastWasRun = false;
        break;
      }

      case 'USER': {
        hasUser = true;
        lastWasRun = false;
        break;
      }

      case 'ADD': {
        // Check if COPY could be used instead
        const addArgs = line.slice(3).trim();
        if (!addArgs.includes('http://') && !addArgs.includes('https://') && !addArgs.includes('.tar')) {
          issues.push({
            line: lineNum,
            severity: 'info',
            rule: 'use-copy-over-add',
            message: 'ADD used where COPY would suffice.',
            suggestion: 'Use COPY instead of ADD for simple file copying. ADD has extra features (URL fetch, tar extraction) that may cause unexpected behavior.',
          });
        }
        lastWasRun = false;
        break;
      }

      case 'EXPOSE': {
        lastWasRun = false;
        break;
      }

      default: {
        lastWasRun = false;
        break;
      }
    }
  }

  // Flush remaining consecutive runs
  if (consecutiveRunCommands.length > 1) {
    emitConsecutiveRunWarning(consecutiveRunCommands, issues);
  }

  // Post-analysis checks
  if (!hasHealthcheck && stages <= 1) {
    issues.push({
      line: 0,
      severity: 'info',
      rule: 'missing-healthcheck',
      message: 'No HEALTHCHECK instruction found.',
      suggestion: 'Add a HEALTHCHECK instruction so Docker can monitor container health.',
    });
  }

  if (!hasUser) {
    issues.push({
      line: 0,
      severity: 'warning',
      rule: 'running-as-root',
      message: 'No USER instruction found. Container will run as root.',
      suggestion: 'Add a USER instruction to run the container as a non-root user for better security.',
    });
  }

  return {
    filePath,
    baseImage,
    stages,
    totalInstructions,
    issues,
    summary: {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    },
  };
}

function emitConsecutiveRunWarning(lineNums: number[], issues: DockerfileIssue[]): void {
  if (lineNums.length > 1) {
    issues.push({
      line: lineNums[0],
      severity: 'warning',
      rule: 'consecutive-run',
      message: `${lineNums.length} consecutive RUN instructions (lines ${lineNums.join(', ')}).`,
      suggestion: 'Combine consecutive RUN instructions using && to reduce image layers.',
    });
  }
}

export function registerAnalyzeDockerfile(server: McpServer, store: DockerStore): void {
  server.tool(
    'analyze-dockerfile',
    'Analyze a Dockerfile for best practices, security issues, and optimization suggestions',
    {
      filePath: z.string().describe('Path to the Dockerfile to analyze'),
    },
    async ({ filePath }) => {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const analysis = analyzeDockerfileContent(filePath, content);

        // Persist the analysis to the store (Dockerfile analysis is stored as a compose analysis
        // with the Dockerfile path and a summary of stages as services)
        store.saveAnalysis({
          filePath,
          serviceCount: analysis.stages,
          services: [analysis.baseImage ?? 'unknown'],
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(analysis, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to analyze Dockerfile: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
