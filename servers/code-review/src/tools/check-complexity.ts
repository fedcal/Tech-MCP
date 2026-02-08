/**
 * Tool: check-complexity
 * Calculates cyclomatic complexity of a code snippet.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReviewStore } from '../services/review-store.js';

interface ComplexityBreakdown {
  pattern: string;
  count: number;
  description: string;
}

interface ComplexityResult {
  totalComplexity: number;
  rating: string;
  breakdown: ComplexityBreakdown[];
  lineCount: number;
  language: string;
}

function countPattern(code: string, pattern: RegExp): number {
  const matches = code.match(pattern);
  return matches ? matches.length : 0;
}

function calculateComplexity(code: string, language: string): ComplexityResult {
  const breakdown: ComplexityBreakdown[] = [];

  // Base complexity starts at 1 (for the main code path)
  let totalComplexity = 1;

  // Common patterns across most languages
  const patterns: Array<{ pattern: RegExp; name: string; description: string }> = [
    { pattern: /\bif\b/g, name: 'if', description: 'If statements' },
    { pattern: /\belse\s+if\b/g, name: 'else if', description: 'Else-if branches' },
    { pattern: /\bfor\b/g, name: 'for', description: 'For loops' },
    { pattern: /\bwhile\b/g, name: 'while', description: 'While loops' },
    { pattern: /\bcase\b/g, name: 'case', description: 'Switch case branches' },
    { pattern: /\bcatch\b/g, name: 'catch', description: 'Catch blocks' },
    { pattern: /&&/g, name: '&&', description: 'Logical AND operators' },
    { pattern: /\|\|/g, name: '||', description: 'Logical OR operators' },
    { pattern: /\?\s*[^?:]/g, name: '?:', description: 'Ternary operators' },
  ];

  // Language-specific patterns
  if (language === 'python') {
    patterns.push(
      { pattern: /\belif\b/g, name: 'elif', description: 'Elif branches' },
      { pattern: /\bexcept\b/g, name: 'except', description: 'Except blocks' },
      { pattern: /\band\b/g, name: 'and', description: 'Logical AND (Python)' },
      { pattern: /\bor\b/g, name: 'or', description: 'Logical OR (Python)' },
    );
  }

  if (language === 'rust') {
    patterns.push(
      { pattern: /\bmatch\b/g, name: 'match', description: 'Match expressions' },
      { pattern: /=>/g, name: '=>', description: 'Match arms' },
    );
  }

  // Strip comments and strings to avoid false positives
  let cleanedCode = code;
  // Remove single-line comments
  cleanedCode = cleanedCode.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  cleanedCode = cleanedCode.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove strings (double and single quoted)
  cleanedCode = cleanedCode.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  cleanedCode = cleanedCode.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  // Remove template literals
  cleanedCode = cleanedCode.replace(/`(?:[^`\\]|\\.)*`/g, '``');

  for (const { pattern, name, description } of patterns) {
    const count = countPattern(cleanedCode, pattern);
    if (count > 0) {
      breakdown.push({ pattern: name, count, description });
      totalComplexity += count;
    }
  }

  // Determine rating
  let rating: string;
  if (totalComplexity <= 5) {
    rating = 'low - simple, easy to understand';
  } else if (totalComplexity <= 10) {
    rating = 'moderate - manageable complexity';
  } else if (totalComplexity <= 20) {
    rating = 'high - consider refactoring';
  } else {
    rating = 'very high - strongly recommend refactoring';
  }

  const lineCount = code.split('\n').length;

  return {
    totalComplexity,
    rating,
    breakdown,
    lineCount,
    language,
  };
}

export function registerCheckComplexity(server: McpServer, store: ReviewStore): void {
  server.tool(
    'check-complexity',
    'Calculate cyclomatic complexity of a code snippet by counting decision points (if, else, for, while, switch, case, catch, &&, ||, ternary)',
    {
      code: z.string().describe('The code snippet to analyze'),
      language: z
        .string()
        .describe('The programming language (e.g., "javascript", "typescript", "python", "rust", "java")'),
    },
    async ({ code, language }) => {
      try {
        const result = calculateComplexity(code, language.toLowerCase());

        store.saveComplexity({
          language: result.language,
          totalComplexity: result.totalComplexity,
          rating: result.rating,
          lineCount: result.lineCount,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to calculate complexity: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
