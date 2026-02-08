/**
 * Tool: find-undocumented
 * Find functions and exports that lack JSDoc/TSDoc comments.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EventBus } from '@mcp-suite/core';
import type { DocsStore } from '../services/docs-store.js';

interface DocumentationItem {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';
  lineNumber: number;
  isDocumented: boolean;
  docComment?: string;
}

function findExportedDeclarations(content: string): DocumentationItem[] {
  const items: DocumentationItem[] = [];
  const lines = content.split('\n');

  // Patterns for exported declarations
  const patterns: Array<{
    regex: RegExp;
    type: DocumentationItem['type'];
  }> = [
    { regex: /^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
    { regex: /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/, type: 'class' },
    { regex: /^export\s+interface\s+(\w+)/, type: 'interface' },
    { regex: /^export\s+type\s+(\w+)\s*=/, type: 'type' },
    { regex: /^export\s+(?:const|let|var)\s+(\w+)/, type: 'const' },
    { regex: /^export\s+enum\s+(\w+)/, type: 'enum' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trimStart();

    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern.regex);
      if (match) {
        // Check if preceded by a JSDoc/TSDoc comment
        const { isDocumented, docComment } = checkForDocComment(lines, i);

        items.push({
          name: match[1],
          type: pattern.type,
          lineNumber: i + 1,
          isDocumented,
          ...(docComment ? { docComment } : {}),
        });
        break;
      }
    }
  }

  // Also find items in export { ... } blocks and trace back to their declarations
  const exportListRegex = /export\s+\{([^}]+)\}/g;
  let exportMatch;
  while ((exportMatch = exportListRegex.exec(content)) !== null) {
    const names = exportMatch[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);

    for (const name of names) {
      // Skip if already found as a direct export
      if (items.some((item) => item.name === name)) continue;

      // Find the declaration
      for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trimStart();

        const declPatterns: Array<{
          regex: RegExp;
          type: DocumentationItem['type'];
        }> = [
          { regex: new RegExp(`^(?:async\\s+)?function\\s+${name}\\b`), type: 'function' },
          { regex: new RegExp(`^(?:abstract\\s+)?class\\s+${name}\\b`), type: 'class' },
          { regex: new RegExp(`^interface\\s+${name}\\b`), type: 'interface' },
          { regex: new RegExp(`^type\\s+${name}\\s*=`), type: 'type' },
          { regex: new RegExp(`^(?:const|let|var)\\s+${name}\\b`), type: 'const' },
          { regex: new RegExp(`^enum\\s+${name}\\b`), type: 'enum' },
        ];

        for (const pattern of declPatterns) {
          if (pattern.regex.test(trimmedLine)) {
            const { isDocumented, docComment } = checkForDocComment(lines, i);
            items.push({
              name,
              type: pattern.type,
              lineNumber: i + 1,
              isDocumented,
              ...(docComment ? { docComment } : {}),
            });
            break;
          }
        }
      }
    }
  }

  return items;
}

function checkForDocComment(
  lines: string[],
  declarationLineIndex: number,
): { isDocumented: boolean; docComment?: string } {
  // Walk backwards from the declaration line to find a /** ... */ comment
  let endIndex = declarationLineIndex - 1;

  // Skip blank lines and single-line comments
  while (endIndex >= 0 && lines[endIndex].trim() === '') {
    endIndex--;
  }

  if (endIndex < 0) return { isDocumented: false };

  const endLine = lines[endIndex].trim();

  // Check if the line ends with */
  if (!endLine.endsWith('*/')) {
    return { isDocumented: false };
  }

  // Find the start of the JSDoc comment
  let startIndex = endIndex;
  while (startIndex >= 0) {
    if (lines[startIndex].trim().startsWith('/**')) {
      const commentLines = lines.slice(startIndex, endIndex + 1).map((l) => l.trim());
      const docComment = commentLines.join('\n');
      return { isDocumented: true, docComment };
    }
    startIndex--;
  }

  return { isDocumented: false };
}

export function registerFindUndocumented(server: McpServer, store: DocsStore, eventBus?: EventBus): void {
  server.tool(
    'find-undocumented',
    'Find functions and exports that lack JSDoc/TSDoc comments in a source file',
    {
      filePath: z.string().describe('Path to the source file to check for documentation'),
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
        const items = findExportedDeclarations(content);

        const documented = items.filter((item) => item.isDocumented);
        const undocumented = items.filter((item) => !item.isDocumented);

        // Persist and publish stale-detected event for each undocumented item
        for (const item of undocumented) {
          store.saveIssue({
            filePath: resolvedPath,
            issueType: 'missing-jsdoc',
            details: `${item.type} "${item.name}" at line ${item.lineNumber} lacks JSDoc/TSDoc documentation`,
          });

          eventBus?.publish('docs:stale-detected', {
            filePath: resolvedPath,
            lastUpdated: new Date().toISOString(),
            reason: `${item.type} "${item.name}" at line ${item.lineNumber} lacks JSDoc/TSDoc documentation`,
          });
        }

        const result = {
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          totalExports: items.length,
          documentedCount: documented.length,
          undocumentedCount: undocumented.length,
          coveragePercent:
            items.length > 0
              ? Math.round((documented.length / items.length) * 100)
              : 100,
          documented: documented.map(({ docComment, ...rest }) => ({
            ...rest,
            docPreview: docComment
              ? docComment.split('\n')[0].replace(/\/\*\*\s*/, '').trim()
              : undefined,
          })),
          undocumented: undocumented.map(({ docComment: _dc, ...rest }) => rest),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error finding undocumented items: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
