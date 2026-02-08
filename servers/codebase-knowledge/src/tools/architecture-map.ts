/**
 * Tool: architecture-map
 * Generate an architecture map (text tree) of a directory.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.cache', 'coverage', '__pycache__']);

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  fileCount?: number;
  extension?: string;
}

function buildTree(dir: string, currentDepth: number, maxDepth: number): TreeNode {
  const name = path.basename(dir);
  const node: TreeNode = {
    name,
    type: 'directory',
    children: [],
    fileCount: 0,
  };

  if (currentDepth >= maxDepth) {
    // Count files without recursing further
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      node.fileCount = entries.filter((e) => e.isFile()).length;
      const subDirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
      if (subDirs.length > 0) {
        node.name += ` (${subDirs.length} subdirs, ${node.fileCount} files)`;
      } else {
        node.name += ` (${node.fileCount} files)`;
      }
    } catch {
      // ignore unreadable directories
    }
    return node;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return node;
  }

  // Sort: directories first, then files
  const dirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

  node.fileCount = files.length;

  for (const d of dirs) {
    const childNode = buildTree(path.join(dir, d.name), currentDepth + 1, maxDepth);
    node.children!.push(childNode);
  }

  for (const f of files) {
    node.children!.push({
      name: f.name,
      type: 'file',
      extension: path.extname(f.name),
    });
  }

  return node;
}

function renderTree(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
  const lines: string[] = [];
  const connector = isLast ? '└── ' : '├── ';
  const icon = node.type === 'directory' ? '📁 ' : '📄 ';

  lines.push(`${prefix}${connector}${icon}${node.name}`);

  if (node.children) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      const childIsLast = index === node.children!.length - 1;
      lines.push(renderTree(child, childPrefix, childIsLast));
    });
  }

  return lines.join('\n');
}

function countExtensions(dir: string, maxDepth: number): Record<string, number> {
  const counts: Record<string, number> = {};

  function walk(d: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name) || '(no ext)';
        counts[ext] = (counts[ext] || 0) + 1;
      }
    }
  }

  walk(dir, 0);
  return counts;
}

export function registerArchitectureMap(server: McpServer): void {
  server.tool(
    'architecture-map',
    'Generate an architecture map (text tree) of a directory with file counts and types',
    {
      directory: z.string().describe('Root directory to scan'),
      maxDepth: z
        .number()
        .optional()
        .default(3)
        .describe('Maximum depth to traverse (default 3)'),
    },
    async ({ directory, maxDepth }) => {
      try {
        const resolvedDir = path.resolve(directory);
        if (!fs.existsSync(resolvedDir)) {
          return {
            content: [{ type: 'text' as const, text: `Directory not found: ${resolvedDir}` }],
            isError: true,
          };
        }

        const tree = buildTree(resolvedDir, 0, maxDepth);
        const treeText = renderTree(tree);
        const extensionCounts = countExtensions(resolvedDir, maxDepth);

        const sortedExtensions = Object.entries(extensionCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([ext, count]) => `  ${ext}: ${count}`)
          .join('\n');

        const output = [
          `Architecture Map: ${resolvedDir}`,
          `Max Depth: ${maxDepth}`,
          '',
          treeText,
          '',
          'File Type Summary:',
          sortedExtensions,
        ].join('\n');

        return {
          content: [{ type: 'text' as const, text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating architecture map: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
