/**
 * Tool: suggest-improvements
 * Suggests improvements for a code snippet.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ReviewStore } from '../services/review-store.js';

interface Suggestion {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  details: string;
}

function stripCommentsAndStrings(code: string): string {
  let cleaned = code;
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  cleaned = cleaned.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  cleaned = cleaned.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  return cleaned;
}

function checkMagicNumbers(code: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const cleaned = stripCommentsAndStrings(code);
  const lines = cleaned.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for numeric literals that are not 0, 1, -1, or common small values
    // Skip array indices, common port numbers, and variable declarations with clear names
    const magicMatches = line.match(/(?<![.\w])(\d{2,}|\d+\.\d+)(?!\s*[;:}\])]?\s*\/\/)/g);
    if (magicMatches) {
      for (const num of magicMatches) {
        const value = parseFloat(num);
        // Skip common acceptable numbers
        if ([0, 1, 2, 10, 100, 1000, 24, 60, 1024].includes(value)) continue;
        // Skip if it looks like it's already in a constant declaration
        if (/(?:const|final|static|readonly)\s+\w+\s*=/.test(line)) continue;

        suggestions.push({
          type: 'magic-number',
          severity: 'medium',
          message: `Magic number ${num} found - consider extracting to a named constant`,
          line: i + 1,
          details: `The number ${num} appears without context. Named constants improve readability and maintainability.`,
        });
      }
    }
  }

  return suggestions;
}

function checkLongFunctions(code: string, language: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = code.split('\n');

  // Detect function boundaries using brace counting or indentation
  const functionPatterns = [
    /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/,
    /(?:(?:public|private|protected|static|async)\s+)*\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/,
    /def\s+\w+\s*\(/,
    /fn\s+\w+\s*\(/,
  ];

  let functionStartLine = -1;
  let braceDepth = 0;
  let inFunction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFunction) {
      for (const pattern of functionPatterns) {
        if (pattern.test(line)) {
          functionStartLine = i;
          inFunction = true;
          braceDepth = 0;
          break;
        }
      }
    }

    if (inFunction) {
      // Count braces for languages using braces
      if (language !== 'python') {
        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') braceDepth--;
        }

        if (braceDepth <= 0 && i > functionStartLine) {
          const functionLength = i - functionStartLine + 1;
          if (functionLength > 30) {
            suggestions.push({
              type: 'long-function',
              severity: 'high',
              message: `Function starting at line ${functionStartLine + 1} is ${functionLength} lines long`,
              line: functionStartLine + 1,
              details: `Functions longer than 30 lines are harder to understand and test. Consider breaking into smaller, focused functions.`,
            });
          }
          inFunction = false;
        }
      }
    }
  }

  return suggestions;
}

function checkDeepNesting(code: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = code.split('\n');

  let currentDepth = 0;
  const maxAcceptableDepth = 4;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const ch of line) {
      if (ch === '{') currentDepth++;
      if (ch === '}') currentDepth--;
    }

    if (currentDepth > maxAcceptableDepth) {
      suggestions.push({
        type: 'deep-nesting',
        severity: 'high',
        message: `Code at line ${i + 1} is nested ${currentDepth} levels deep`,
        line: i + 1,
        details: `Deeply nested code (>${maxAcceptableDepth} levels) is hard to read. Consider using early returns, guard clauses, or extracting logic into separate functions.`,
      });
    }
  }

  // Deduplicate deep nesting warnings to avoid flooding
  const deduped: Suggestion[] = [];
  let lastReportedLine = -10;
  for (const s of suggestions) {
    if (s.line !== undefined && s.line - lastReportedLine >= 5) {
      deduped.push(s);
      lastReportedLine = s.line;
    }
  }

  return deduped;
}

function checkDuplicatePatterns(code: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = code.split('\n').map((l) => l.trim()).filter((l) => l.length > 10);

  const lineCounts = new Map<string, number[]>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip trivial lines like closing braces, returns, etc.
    if (/^[{}()\[\];,]$/.test(line)) continue;
    if (/^(?:return|break|continue|else)\s*;?\s*$/.test(line)) continue;

    const existing = lineCounts.get(line);
    if (existing) {
      existing.push(i + 1);
    } else {
      lineCounts.set(line, [i + 1]);
    }
  }

  for (const [line, occurrences] of lineCounts) {
    if (occurrences.length >= 3) {
      suggestions.push({
        type: 'duplicate-code',
        severity: 'medium',
        message: `Duplicate code pattern found ${occurrences.length} times`,
        line: occurrences[0],
        details: `The line "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}" appears ${occurrences.length} times (lines ${occurrences.join(', ')}). Consider extracting to a reusable function or variable.`,
      });
    }
  }

  return suggestions;
}

function checkUnusedVariables(code: string, language: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const cleaned = stripCommentsAndStrings(code);

  // Detect variable declarations
  let varPattern: RegExp;
  if (language === 'python') {
    varPattern = /^[ \t]*(\w+)\s*=/gm;
  } else {
    varPattern = /(?:const|let|var|final)\s+(\w+)\s*[=:]/gm;
  }

  let match;
  while ((match = varPattern.exec(cleaned)) !== null) {
    const varName = match[1];
    // Skip common patterns like _, __, and very short names (loop counters)
    if (varName.startsWith('_') || varName.length <= 1) continue;

    // Count occurrences of the variable name (word boundary)
    const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
    const usages = cleaned.match(usagePattern);
    const usageCount = usages ? usages.length : 0;

    // If the variable appears only once (in its declaration), it may be unused
    if (usageCount === 1) {
      const declarationLine = cleaned.substring(0, match.index).split('\n').length;
      suggestions.push({
        type: 'potentially-unused-variable',
        severity: 'low',
        message: `Variable "${varName}" may be unused`,
        line: declarationLine,
        details: `The variable "${varName}" appears to be declared but only referenced once (in its declaration). Verify it is needed.`,
      });
    }
  }

  return suggestions;
}

export function registerSuggestImprovements(server: McpServer, store: ReviewStore, eventBus?: EventBus): void {
  server.tool(
    'suggest-improvements',
    'Suggest improvements for a code snippet including duplicate code patterns, magic numbers, long functions, deeply nested code, and unused variable patterns',
    {
      code: z.string().describe('The code snippet to analyze'),
      language: z
        .string()
        .describe('The programming language (e.g., "javascript", "typescript", "python", "java")'),
    },
    async ({ code, language }) => {
      try {
        const lang = language.toLowerCase();
        const suggestions: Suggestion[] = [
          ...checkMagicNumbers(code),
          ...checkLongFunctions(code, lang),
          ...checkDeepNesting(code),
          ...checkDuplicatePatterns(code),
          ...checkUnusedVariables(code, lang),
        ];

        // Sort by severity
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        const result = {
          totalSuggestions: suggestions.length,
          suggestionsByType: suggestions.reduce(
            (acc, s) => {
              acc[s.type] = (acc[s.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          suggestionsBySeverity: {
            high: suggestions.filter((s) => s.severity === 'high').length,
            medium: suggestions.filter((s) => s.severity === 'medium').length,
            low: suggestions.filter((s) => s.severity === 'low').length,
          },
          suggestions,
        };

        store.saveReview({
          reviewType: 'suggest-improvements',
          issuesFound: suggestions.length,
          suggestions: suggestions.map((s) => s.message),
          result: JSON.stringify(result),
        });

        eventBus?.publish('code:review-completed', {
          files: [],
          issues: suggestions.length,
          suggestions: suggestions.map((s) => s.message),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to suggest improvements: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
