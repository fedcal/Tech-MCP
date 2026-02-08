/**
 * Tool: search-code
 * Search for a pattern in a codebase directory.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KnowledgeStore } from '../services/knowledge-store.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.cache', 'coverage', '__pycache__']);

function walkDirectory(dir: string, fileExtensions?: string[]): string[] {
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath, fileExtensions));
    } else if (entry.isFile()) {
      if (fileExtensions && fileExtensions.length > 0) {
        const ext = path.extname(entry.name);
        if (!fileExtensions.includes(ext)) continue;
      }
      results.push(fullPath);
    }
  }

  return results;
}

export function registerSearchCode(server: McpServer, store: KnowledgeStore): void {
  server.tool(
    'search-code',
    'Search for a pattern (string or regex) in a codebase directory and return matching files with line numbers',
    {
      directory: z.string().describe('Root directory to search in'),
      pattern: z.string().describe('Search pattern (string or regex)'),
      fileExtensions: z
        .array(z.string())
        .optional()
        .describe('Optional file extensions to filter (e.g. [".ts", ".js"])'),
      maxResults: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of results to return (default 20)'),
    },
    async ({ directory, pattern, fileExtensions, maxResults }) => {
      try {
        const resolvedDir = path.resolve(directory);
        if (!fs.existsSync(resolvedDir)) {
          return {
            content: [{ type: 'text' as const, text: `Directory not found: ${resolvedDir}` }],
            isError: true,
          };
        }

        let regex: RegExp;
        try {
          regex = new RegExp(pattern, 'g');
        } catch {
          // Treat as literal string if not valid regex
          regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        }

        const files = walkDirectory(resolvedDir, fileExtensions);
        const matches: Array<{
          file: string;
          relativePath: string;
          lines: Array<{ lineNumber: number; content: string }>;
        }> = [];

        let totalMatches = 0;

        for (const filePath of files) {
          if (totalMatches >= maxResults) break;

          let content: string;
          try {
            content = fs.readFileSync(filePath, 'utf-8');
          } catch {
            continue;
          }

          const lines = content.split('\n');
          const matchingLines: Array<{ lineNumber: number; content: string }> = [];

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= maxResults) break;

            regex.lastIndex = 0;
            if (regex.test(lines[i])) {
              matchingLines.push({
                lineNumber: i + 1,
                content: lines[i].trim(),
              });
              totalMatches++;
            }
          }

          if (matchingLines.length > 0) {
            matches.push({
              file: filePath,
              relativePath: path.relative(resolvedDir, filePath),
              lines: matchingLines,
            });
          }
        }

        const summary = {
          directory: resolvedDir,
          pattern,
          fileExtensions: fileExtensions || null,
          totalFilesScanned: files.length,
          totalMatches,
          matchingFiles: matches.length,
          matches,
        };

        // Persist search to history
        store.saveSearch({
          query: pattern,
          directory: resolvedDir,
          matchCount: totalMatches,
          results: matches,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching code: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
