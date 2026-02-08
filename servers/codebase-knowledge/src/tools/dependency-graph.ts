/**
 * Tool: dependency-graph
 * Build an internal module dependency graph by scanning import statements.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.cache', 'coverage', '__pycache__']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts']);

function collectSourceFiles(dir: string): string[] {
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
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function parseImports(content: string): string[] {
  const imports: string[] = [];

  // Match: import ... from 'source'
  const importFromRegex = /import\s+(?:[^'"]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importFromRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match: import 'source' (side-effect imports)
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match: require('source')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function resolveImportPath(importSource: string, fromFile: string, allFiles: string[]): string | null {
  // Only resolve relative imports
  if (!importSource.startsWith('.')) return null;

  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, importSource);

  // Try exact match, then with extensions
  const candidates = [
    resolved,
    ...Array.from(SOURCE_EXTENSIONS).map((ext) => resolved + ext),
    ...Array.from(SOURCE_EXTENSIONS).map((ext) => path.join(resolved, 'index' + ext)),
  ];

  // Also handle .js -> .ts resolution
  if (importSource.endsWith('.js')) {
    const withoutJs = resolved.slice(0, -3);
    candidates.push(withoutJs + '.ts', withoutJs + '.tsx');
  }

  for (const candidate of candidates) {
    if (allFiles.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

function generateMermaid(graph: Record<string, string[]>, baseDir: string): string {
  const lines: string[] = ['graph LR'];

  const nodeIds = new Map<string, string>();
  let counter = 0;

  function getNodeId(filePath: string): string {
    if (!nodeIds.has(filePath)) {
      nodeIds.set(filePath, `N${counter++}`);
    }
    return nodeIds.get(filePath)!;
  }

  for (const [source, targets] of Object.entries(graph)) {
    if (targets.length === 0) continue;

    const sourceRel = path.relative(baseDir, source);
    const sourceId = getNodeId(source);

    for (const target of targets) {
      const targetRel = path.relative(baseDir, target);
      const targetId = getNodeId(target);
      lines.push(`  ${sourceId}["${sourceRel}"] --> ${targetId}["${targetRel}"]`);
    }
  }

  return lines.join('\n');
}

export function registerDependencyGraph(server: McpServer): void {
  server.tool(
    'dependency-graph',
    'Build an internal module dependency graph by scanning import/require statements in .ts/.js files',
    {
      directory: z.string().describe('Root directory to scan for source files'),
    },
    async ({ directory }) => {
      try {
        const resolvedDir = path.resolve(directory);
        if (!fs.existsSync(resolvedDir)) {
          return {
            content: [{ type: 'text' as const, text: `Directory not found: ${resolvedDir}` }],
            isError: true,
          };
        }

        const files = collectSourceFiles(resolvedDir);
        const graph: Record<string, string[]> = {};

        for (const filePath of files) {
          const relPath = path.relative(resolvedDir, filePath);
          let content: string;
          try {
            content = fs.readFileSync(filePath, 'utf-8');
          } catch {
            continue;
          }

          const importSources = parseImports(content);
          const resolvedImports: string[] = [];

          for (const importSource of importSources) {
            const resolved = resolveImportPath(importSource, filePath, files);
            if (resolved) {
              resolvedImports.push(path.relative(resolvedDir, resolved));
            }
          }

          graph[relPath] = [...new Set(resolvedImports)];
        }

        // Build absolute-path graph for Mermaid
        const absGraph: Record<string, string[]> = {};
        for (const filePath of files) {
          const relPath = path.relative(resolvedDir, filePath);
          absGraph[filePath] = (graph[relPath] || []).map((rel) => path.join(resolvedDir, rel));
        }

        const mermaid = generateMermaid(absGraph, resolvedDir);

        const totalFiles = files.length;
        const totalEdges = Object.values(graph).reduce((sum, deps) => sum + deps.length, 0);

        const result = {
          directory: resolvedDir,
          totalFiles,
          totalDependencyEdges: totalEdges,
          adjacencyList: graph,
          mermaidDiagram: mermaid,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error building dependency graph: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
