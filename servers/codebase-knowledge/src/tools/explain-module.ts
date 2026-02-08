/**
 * Tool: explain-module
 * Analyze a source file and provide a summary of its structure.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KnowledgeStore } from '../services/knowledge-store.js';

interface ModuleSummary {
  filePath: string;
  fileName: string;
  extension: string;
  lineCount: number;
  imports: Array<{ source: string; specifiers: string[] }>;
  exports: string[];
  functions: string[];
  classes: string[];
  interfaces: string[];
  typeAliases: string[];
}

function extractImports(content: string): Array<{ source: string; specifiers: string[] }> {
  const imports: Array<{ source: string; specifiers: string[] }> = [];

  // Match: import { X, Y } from 'module'
  const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const specifiers = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    imports.push({ source: match[2], specifiers });
  }

  // Match: import X from 'module'
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    imports.push({ source: match[2], specifiers: [match[1]] });
  }

  // Match: import * as X from 'module'
  const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceImportRegex.exec(content)) !== null) {
    imports.push({ source: match[2], specifiers: [`* as ${match[1]}`] });
  }

  return imports;
}

function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Match: export function/const/class/interface/type/enum name
  const exportDeclRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = exportDeclRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Match: export { X, Y }
  const exportListRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(content)) !== null) {
    const names = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    exports.push(...names);
  }

  // Match: export default
  if (/export\s+default\s+/.test(content) && !exports.includes('default')) {
    exports.push('default');
  }

  return [...new Set(exports)];
}

function extractFunctions(content: string): string[] {
  const functions: string[] = [];
  const regex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    functions.push(match[1]);
  }

  // Arrow function assignments: const name = (...) =>
  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }

  return [...new Set(functions)];
}

function extractClasses(content: string): string[] {
  const classes: string[] = [];
  const regex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

function extractInterfaces(content: string): string[] {
  const interfaces: string[] = [];
  const regex = /(?:export\s+)?interface\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    interfaces.push(match[1]);
  }
  return interfaces;
}

function extractTypeAliases(content: string): string[] {
  const types: string[] = [];
  const regex = /(?:export\s+)?type\s+(\w+)\s*=/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    types.push(match[1]);
  }
  return types;
}

export function registerExplainModule(server: McpServer, store: KnowledgeStore): void {
  server.tool(
    'explain-module',
    'Analyze a source file and provide a summary including imports, exports, functions, classes, and line count',
    {
      filePath: z.string().describe('Path to the source file to analyze'),
    },
    async ({ filePath }) => {
      try {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
          return {
            content: [{ type: 'text' as const, text: `File not found: ${resolvedPath}` }],
            isError: true,
          };
        }

        const content = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = content.split('\n');

        const summary: ModuleSummary = {
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          extension: path.extname(resolvedPath),
          lineCount: lines.length,
          imports: extractImports(content),
          exports: extractExports(content),
          functions: extractFunctions(content),
          classes: extractClasses(content),
          interfaces: extractInterfaces(content),
          typeAliases: extractTypeAliases(content),
        };

        // Persist module explanation
        store.saveExplanation({
          modulePath: resolvedPath,
          explanation: JSON.stringify(summary),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing module: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
