/**
 * Tool: analyze-bundle
 * Analyzes JavaScript/TypeScript code for bundle size concerns.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { ProfilerStore } from '../services/profiler-store.js';

interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isHeavy: boolean;
}

interface BundleAnalysis {
  filePath: string;
  fileSize: number;
  imports: ImportInfo[];
  totalImports: number;
  heavyDependencies: Array<{
    name: string;
    reason: string;
    suggestion: string;
  }>;
  summary: {
    totalFiles: number;
    totalSize: number;
    heavyDependencyCount: number;
    estimatedBundleImpact: string;
  };
}

const HEAVY_PACKAGES: Record<string, { reason: string; suggestion: string }> = {
  moment: {
    reason: 'Moment.js is ~300KB with locales',
    suggestion: 'Use date-fns (~20KB) or dayjs (~2KB) instead',
  },
  lodash: {
    reason: 'Full lodash is ~70KB minified',
    suggestion: 'Use lodash-es with tree shaking or import individual functions: lodash/get',
  },
  'lodash.': {
    reason: 'Individual lodash packages add up',
    suggestion: 'Consider using lodash-es for better tree shaking',
  },
  rxjs: {
    reason: 'Full RxJS import can be ~50KB+',
    suggestion: 'Import only specific operators: rxjs/operators',
  },
  'aws-sdk': {
    reason: 'Full AWS SDK is very large (>100MB)',
    suggestion: 'Use @aws-sdk/client-* v3 modular packages',
  },
  '@material-ui': {
    reason: 'Material UI can be 300KB+ without tree shaking',
    suggestion: 'Use named imports and ensure tree shaking is configured',
  },
  '@mui': {
    reason: 'MUI can be large without proper tree shaking',
    suggestion: 'Use named imports from specific packages: @mui/material/Button',
  },
  'chart.js': {
    reason: 'Chart.js is ~200KB',
    suggestion: 'Register only needed chart types and components',
  },
  three: {
    reason: 'Three.js is ~600KB+',
    suggestion: 'Import specific modules from three/examples/jsm/',
  },
  jquery: {
    reason: 'jQuery is ~85KB minified',
    suggestion: 'Use native DOM APIs instead',
  },
  underscore: {
    reason: 'Underscore.js is ~20KB, mostly replaceable',
    suggestion: 'Use native Array/Object methods or lodash-es',
  },
};

function parseImports(code: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Match ES module imports
  const importRegex = /import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?(?:\*\s+as\s+(\w+))?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const defaultImport = match[1];
    const namedImports = match[2];
    const namespaceImport = match[3];
    const source = match[4];

    const specifiers: string[] = [];
    if (defaultImport) specifiers.push(defaultImport);
    if (namedImports) {
      specifiers.push(
        ...namedImports
          .split(',')
          .map((s) => s.trim().split(' as ')[0].trim())
          .filter((s) => s.length > 0),
      );
    }
    if (namespaceImport) specifiers.push(`* as ${namespaceImport}`);

    const isHeavy = Object.keys(HEAVY_PACKAGES).some(
      (pkg) => source === pkg || source.startsWith(pkg + '/') || source.startsWith(pkg),
    );

    imports.push({
      source,
      specifiers,
      isDefault: !!defaultImport,
      isNamespace: !!namespaceImport,
      isHeavy,
    });
  }

  // Match require() calls
  const requireRegex = /(?:const|let|var)\s+(?:(\w+)|(\{[^}]*\}))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    const source = match[3];
    const specifiers: string[] = [];
    if (match[1]) specifiers.push(match[1]);
    if (match[2]) {
      specifiers.push(
        ...match[2]
          .replace(/[{}]/g, '')
          .split(',')
          .map((s) => s.trim().split(':')[0].trim())
          .filter((s) => s.length > 0),
      );
    }

    const isHeavy = Object.keys(HEAVY_PACKAGES).some(
      (pkg) => source === pkg || source.startsWith(pkg + '/') || source.startsWith(pkg),
    );

    imports.push({
      source,
      specifiers,
      isDefault: !!match[1],
      isNamespace: false,
      isHeavy,
    });
  }

  return imports;
}

function getHeavyDependencyInfo(
  imports: ImportInfo[],
): BundleAnalysis['heavyDependencies'] {
  const heavy: BundleAnalysis['heavyDependencies'] = [];

  for (const imp of imports) {
    for (const [pkg, info] of Object.entries(HEAVY_PACKAGES)) {
      if (imp.source === pkg || imp.source.startsWith(pkg + '/') || imp.source.startsWith(pkg)) {
        heavy.push({
          name: imp.source,
          reason: info.reason,
          suggestion: info.suggestion,
        });
        break;
      }
    }
  }

  return heavy;
}

function analyzeFile(filePath: string): { code: string; size: number } | null {
  try {
    const stat = statSync(filePath);
    if (stat.isFile()) {
      const ext = extname(filePath);
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        return {
          code: readFileSync(filePath, 'utf-8'),
          size: stat.size,
        };
      }
    }
  } catch {
    // File not accessible
  }
  return null;
}

function collectFiles(dirPath: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...collectFiles(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory not accessible
  }
  return files;
}

export function registerAnalyzeBundle(server: McpServer, store: ProfilerStore): void {
  server.tool(
    'analyze-bundle',
    'Analyze JavaScript/TypeScript files for bundle size concerns, heavy dependencies, and import counts',
    {
      filePath: z
        .string()
        .describe('Path to a JavaScript/TypeScript file or directory to analyze'),
    },
    async ({ filePath }) => {
      try {
        let totalSize = 0;
        let totalFiles = 0;
        const allImports: ImportInfo[] = [];

        const stat = statSync(filePath);

        if (stat.isDirectory()) {
          const files = collectFiles(filePath);
          for (const file of files) {
            const result = analyzeFile(file);
            if (result) {
              totalFiles++;
              totalSize += result.size;
              allImports.push(...parseImports(result.code));
            }
          }
        } else {
          const result = analyzeFile(filePath);
          if (result) {
            totalFiles = 1;
            totalSize = result.size;
            allImports.push(...parseImports(result.code));
          } else {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `File "${filePath}" is not a supported JavaScript/TypeScript file.`,
                },
              ],
              isError: true,
            };
          }
        }

        const heavyDeps = getHeavyDependencyInfo(allImports);

        const analysis: BundleAnalysis = {
          filePath,
          fileSize: totalSize,
          imports: allImports,
          totalImports: allImports.length,
          heavyDependencies: heavyDeps,
          summary: {
            totalFiles,
            totalSize,
            heavyDependencyCount: heavyDeps.length,
            estimatedBundleImpact:
              heavyDeps.length === 0
                ? 'Low - no known heavy dependencies detected'
                : heavyDeps.length <= 2
                  ? 'Medium - some heavy dependencies found'
                  : 'High - multiple heavy dependencies detected',
          },
        };

        // Persist to store
        store.saveBundleAnalysis({
          filePath,
          totalSize,
          result: analysis as unknown as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(analysis, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing bundle: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
