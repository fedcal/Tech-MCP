/**
 * Tool: list-services
 * List running Docker services using docker compose or docker CLI.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DockerStore } from '../services/docker-store.js';

interface ServiceInfo {
  name: string;
  status: string;
  image?: string;
  ports?: string;
  [key: string]: unknown;
}

function parseJsonLines(output: string): ServiceInfo[] {
  const lines = output.trim().split('\n').filter((line) => line.trim() !== '');
  const services: ServiceInfo[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      services.push({
        name: (parsed['Name'] as string) || (parsed['Names'] as string) || 'unknown',
        status: (parsed['Status'] as string) || (parsed['State'] as string) || 'unknown',
        image: (parsed['Image'] as string) || undefined,
        ports: (parsed['Ports'] as string) || undefined,
        ...parsed,
      });
    } catch {
      // If a line is not valid JSON, skip it
    }
  }

  return services;
}

export function registerListServices(server: McpServer, store: DockerStore): void {
  server.tool(
    'list-services',
    'List running Docker services. Optionally scoped to a specific docker-compose project.',
    {
      composePath: z
        .string()
        .optional()
        .describe('Optional path to a docker-compose.yml file to scope the listing'),
    },
    async ({ composePath }) => {
      try {
        let output: string;

        if (composePath) {
          // Validate the compose file exists
          if (!existsSync(composePath)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Compose file not found: ${composePath}`,
                },
              ],
              isError: true,
            };
          }

          const composeDir = dirname(composePath);

          try {
            output = execSync('docker compose ps --format json', {
              cwd: composeDir,
              encoding: 'utf-8',
              timeout: 15000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          } catch {
            // Fallback to docker-compose (legacy)
            output = execSync('docker-compose ps --format json', {
              cwd: composeDir,
              encoding: 'utf-8',
              timeout: 15000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          }
        } else {
          // List all running containers
          try {
            output = execSync(
              'docker ps --format json',
              {
                encoding: 'utf-8',
                timeout: 15000,
                stdio: ['pipe', 'pipe', 'pipe'],
              },
            );
          } catch {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Failed to list services. Is Docker running? Make sure the Docker daemon is started.',
                },
              ],
              isError: true,
            };
          }
        }

        const services = parseJsonLines(output);

        const result = {
          composePath: composePath || null,
          serviceCount: services.length,
          services,
        };

        // Persist the listing as an analysis snapshot
        store.saveAnalysis({
          filePath: composePath ?? 'docker-ps',
          serviceCount: services.length,
          services: services.map((s) => s.name),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list services: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
