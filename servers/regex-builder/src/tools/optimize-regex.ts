/**
 * Tool: optimize-regex
 * Analyzes a regex for potential performance issues and suggests optimizations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegexStore } from '../services/regex-store.js';

interface Issue {
  severity: 'warning' | 'info';
  message: string;
  suggestion?: string;
}

function analyzeRegex(pattern: string): Issue[] {
  const issues: Issue[] = [];

  // Check for catastrophic backtracking patterns
  if (/\(\.\*\)\+/.test(pattern) || /\(\.\+\)\+/.test(pattern) || /\(\.\*\)\*/.test(pattern)) {
    issues.push({
      severity: 'warning',
      message: 'Nested quantifiers detected (e.g., (.*)+). This can cause catastrophic backtracking.',
      suggestion: 'Use atomic groups or possessive quantifiers, or restructure the pattern.',
    });
  }

  // Check for unanchored .* at the start
  if (/^\.\*[^?]/.test(pattern) && !pattern.startsWith('^')) {
    issues.push({
      severity: 'info',
      message: 'Pattern starts with .* without anchoring. This may be slow on large inputs.',
      suggestion: 'Consider anchoring with ^ if matching from the start.',
    });
  }

  // Check for redundant character classes
  if (/\[a-zA-Z0-9_\]/.test(pattern)) {
    issues.push({
      severity: 'info',
      message: '[a-zA-Z0-9_] is equivalent to \\w.',
      suggestion: 'Replace with \\w for brevity.',
    });
  }

  if (/\[0-9\]/.test(pattern)) {
    issues.push({
      severity: 'info',
      message: '[0-9] is equivalent to \\d.',
      suggestion: 'Replace with \\d for brevity.',
    });
  }

  // Check for alternation that could be a character class
  if (/\(([a-zA-Z]\|)+[a-zA-Z]\)/.test(pattern)) {
    issues.push({
      severity: 'info',
      message: 'Single-character alternation (a|b|c) could be a character class [abc].',
      suggestion: 'Use a character class for better performance.',
    });
  }

  // Check for unnecessary escapes
  const unnecessaryEscapes = pattern.match(/\\([a-zA-Z])/g) || [];
  const validEscapes = new Set([
    'd', 'D', 'w', 'W', 's', 'S', 'b', 'B', 'n', 't', 'r', 'f', 'v',
    'p', 'P', 'k', 'x', 'u', 'c',
  ]);
  for (const esc of unnecessaryEscapes) {
    const char = esc[1];
    if (!validEscapes.has(char)) {
      issues.push({
        severity: 'info',
        message: `\\${char} is not a standard escape. '${char}' doesn't need escaping outside character classes.`,
      });
    }
  }

  // Check for very long alternations
  const alternations = pattern.split('|');
  if (alternations.length > 10) {
    issues.push({
      severity: 'warning',
      message: `Pattern has ${alternations.length} alternations. Consider if a trie-based approach or other data structure would be more efficient.`,
    });
  }

  if (issues.length === 0) {
    issues.push({
      severity: 'info',
      message: 'No obvious optimization issues found. The pattern looks good.',
    });
  }

  return issues;
}

export function registerOptimizeRegex(server: McpServer, store: RegexStore): void {
  server.tool(
    'optimize-regex',
    'Analyze a regex pattern for performance issues and suggest optimizations',
    {
      pattern: z.string().describe('The regex pattern to analyze'),
      flags: z.string().optional().describe('Regex flags'),
    },
    async ({ pattern, flags }) => {
      try {
        new RegExp(pattern, flags || '');
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid regex: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }

      const issues = analyzeRegex(pattern);

      const output = {
        pattern,
        flags: flags || '',
        issues,
        totalIssues: issues.length,
        warnings: issues.filter((i) => i.severity === 'warning').length,
      };

      // Log optimize operation to history
      store.logOperation({
        operation: 'optimize',
        pattern,
        flags: flags || '',
        result: output,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
      };
    },
  );
}
