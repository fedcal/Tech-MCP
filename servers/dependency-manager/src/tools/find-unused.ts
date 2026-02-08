/**
 * Tool: find-unused
 * Analyzes a project directory to find potentially unused dependencies.
 * Reads package.json dependencies, then searches source files for import statements.
 * Reports dependencies not found in any import.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DependencyStore } from '../services/dependency-store.js';

/**
 * Recursively collect all source files matching the given extensions.
 */
function collectSourceFiles(dir: string, extensions: string[], result: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return result;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    // Skip common non-source directories
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === '.git' || entry === 'coverage') {
      continue;
    }

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, extensions, result);
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      result.push(fullPath);
    }
  }

  return result;
}

/**
 * Extract package names from import/require statements in file content.
 */
function extractImportedPackages(content: string): Set<string> {
  const packages = new Set<string>();

  // Match ES module imports: import ... from 'package' / import 'package'
  const esImportRegex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"])([^'"./][^'"]*)['"]/g;
  // Match CommonJS requires: require('package')
  const requireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  // Match dynamic imports: import('package')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;

  for (const regex of [esImportRegex, requireRegex, dynamicImportRegex]) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const imported = match[1];
      // Extract the package name (handle scoped packages like @scope/package)
      if (imported.startsWith('@')) {
        const parts = imported.split('/');
        if (parts.length >= 2) {
          packages.add(`${parts[0]}/${parts[1]}`);
        }
      } else {
        const parts = imported.split('/');
        packages.add(parts[0]);
      }
    }
  }

  return packages;
}

export function registerFindUnused(server: McpServer, store: DependencyStore): void {
  server.tool(
    'find-unused',
    'Find potentially unused dependencies in a project by analyzing import statements in source files',
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

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        const allDeps = [...dependencies, ...devDependencies];

        if (allDeps.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ message: 'No dependencies found in package.json', unused: [] }, null, 2),
              },
            ],
          };
        }

        // Collect all source files
        const extensions = ['.ts', '.js', '.tsx', '.jsx'];
        const sourceFiles = collectSourceFiles(projectPath, extensions);

        // Extract all imported packages from all source files
        const allImportedPackages = new Set<string>();
        const fileImports: Record<string, string[]> = {};

        for (const filePath of sourceFiles) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const packages = extractImportedPackages(content);
            const relPath = relative(projectPath, filePath);
            fileImports[relPath] = [...packages];
            for (const pkg of packages) {
              allImportedPackages.add(pkg);
            }
          } catch {
            // Skip files that can't be read
          }
        }

        // Find unused dependencies
        const unusedDeps = dependencies.filter((dep) => !allImportedPackages.has(dep));
        const unusedDevDeps = devDependencies.filter((dep) => !allImportedPackages.has(dep));

        // Also find used deps for context
        const usedDeps = dependencies.filter((dep) => allImportedPackages.has(dep));
        const usedDevDeps = devDependencies.filter((dep) => allImportedPackages.has(dep));

        const result = {
          project: packageJson.name || 'unknown',
          projectPath,
          sourceFilesScanned: sourceFiles.length,
          summary: {
            totalDependencies: dependencies.length,
            totalDevDependencies: devDependencies.length,
            unusedDependencies: unusedDeps.length,
            unusedDevDependencies: unusedDevDeps.length,
          },
          unusedDependencies: unusedDeps,
          unusedDevDependencies: unusedDevDeps,
          usedDependencies: usedDeps,
          usedDevDependencies: usedDevDeps,
          note: 'Dependencies may be used in config files, scripts, or other non-source files. Verify before removing.',
        };

        // Persist the scan result
        store.saveScan({
          projectPath,
          vulnerabilityCount: unusedDeps.length + unusedDevDeps.length,
          criticalCount: 0,
          highCount: 0,
          results: JSON.stringify(result),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error finding unused dependencies: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
