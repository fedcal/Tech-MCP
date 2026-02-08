/**
 * Tool: list-environments
 * Lists .env files found in a given directory.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EnvStore } from '../services/env-store.js';

export function registerListEnvironments(server: McpServer, store: EnvStore): void {
  server.tool(
    'list-environments',
    'List .env files found in a directory (e.g., .env, .env.local, .env.production)',
    {
      directory: z.string().describe('The directory path to search for .env files'),
      recursive: z
        .boolean()
        .optional()
        .describe('Whether to search subdirectories (default: false)'),
    },
    async ({ directory, recursive }) => {
      try {
        const resolvedDir = path.resolve(directory);

        if (!fs.existsSync(resolvedDir)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Directory not found: ${resolvedDir}`,
              },
            ],
            isError: true,
          };
        }

        const stat = fs.statSync(resolvedDir);
        if (!stat.isDirectory()) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Path is not a directory: ${resolvedDir}`,
              },
            ],
            isError: true,
          };
        }

        const envFiles = findEnvFiles(resolvedDir, recursive || false);

        const results = envFiles.map((filePath) => {
          const fileStat = fs.statSync(filePath);
          return {
            path: filePath,
            name: path.basename(filePath),
            relativePath: path.relative(resolvedDir, filePath),
            size: fileStat.size,
            lastModified: fileStat.mtime.toISOString(),
          };
        });

        const summary = {
          directory: resolvedDir,
          recursive: recursive || false,
          totalFound: results.length,
          files: results,
        };

        // Persist a snapshot for each found env file
        for (const file of results) {
          store.saveSnapshot({
            envName: file.name,
            filePath: file.path,
            variableCount: 0,
            variables: [],
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
              text: `Error listing environments: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

function findEnvFiles(dir: string, recursive: boolean): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && isEnvFile(entry.name)) {
      results.push(fullPath);
    } else if (entry.isDirectory() && recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...findEnvFiles(fullPath, true));
    }
  }

  return results.sort();
}

function isEnvFile(fileName: string): boolean {
  // Match .env, .env.local, .env.production, .env.example, etc.
  return /^\.env(\..+)?$/.test(fileName);
}
