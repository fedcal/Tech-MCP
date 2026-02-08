/**
 * Tool: explain-regex
 * Explains a regex pattern in plain language.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegexStore } from '../services/regex-store.js';

interface TokenExplanation {
  token: string;
  explanation: string;
}

function explainToken(token: string): string {
  const explanations: Record<string, string> = {
    '^': 'Start of string/line',
    $: 'End of string/line',
    '.': 'Any character (except newline)',
    '*': 'Zero or more of the previous',
    '+': 'One or more of the previous',
    '?': 'Zero or one of the previous (optional)',
    '\\d': 'Any digit (0-9)',
    '\\D': 'Any non-digit',
    '\\w': 'Any word character (letter, digit, underscore)',
    '\\W': 'Any non-word character',
    '\\s': 'Any whitespace character',
    '\\S': 'Any non-whitespace character',
    '\\b': 'Word boundary',
    '\\B': 'Non-word boundary',
    '\\n': 'Newline',
    '\\t': 'Tab',
    '\\r': 'Carriage return',
  };
  return explanations[token] || '';
}

function tokenize(pattern: string): TokenExplanation[] {
  const tokens: TokenExplanation[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '\\' && i + 1 < pattern.length) {
      const escaped = pattern.substring(i, i + 2);
      const explanation = explainToken(escaped);
      tokens.push({
        token: escaped,
        explanation: explanation || `Literal '${pattern[i + 1]}'`,
      });
      i += 2;
    } else if (ch === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) {
        tokens.push({ token: ch, explanation: 'Start of character class (unclosed)' });
        i++;
      } else {
        const charClass = pattern.substring(i, end + 1);
        const negated = charClass[1] === '^';
        tokens.push({
          token: charClass,
          explanation: `${negated ? 'Not any of' : 'Any of'}: ${charClass.slice(negated ? 2 : 1, -1)}`,
        });
        i = end + 1;
      }
    } else if (ch === '(') {
      let groupType = 'Capturing group';
      let skip = 1;
      if (pattern[i + 1] === '?') {
        if (pattern[i + 2] === ':') {
          groupType = 'Non-capturing group';
          skip = 3;
        } else if (pattern[i + 2] === '=') {
          groupType = 'Positive lookahead';
          skip = 3;
        } else if (pattern[i + 2] === '!') {
          groupType = 'Negative lookahead';
          skip = 3;
        } else if (pattern[i + 2] === '<' && pattern[i + 3] === '=') {
          groupType = 'Positive lookbehind';
          skip = 4;
        } else if (pattern[i + 2] === '<' && pattern[i + 3] === '!') {
          groupType = 'Negative lookbehind';
          skip = 4;
        } else if (pattern[i + 2] === '<') {
          const nameEnd = pattern.indexOf('>', i + 3);
          if (nameEnd !== -1) {
            const name = pattern.substring(i + 3, nameEnd);
            groupType = `Named capturing group '${name}'`;
            skip = nameEnd - i + 1;
          }
        }
      }
      tokens.push({ token: pattern.substring(i, i + skip), explanation: `${groupType} start` });
      i += skip;
    } else if (ch === ')') {
      tokens.push({ token: ')', explanation: 'Group end' });
      i++;
    } else if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const quantifier = pattern.substring(i, end + 1);
        const inner = quantifier.slice(1, -1);
        const parts = inner.split(',');
        let explanation: string;
        if (parts.length === 1) {
          explanation = `Exactly ${parts[0]} times`;
        } else if (parts[1] === '') {
          explanation = `${parts[0]} or more times`;
        } else {
          explanation = `Between ${parts[0]} and ${parts[1]} times`;
        }
        tokens.push({ token: quantifier, explanation });
        i = end + 1;
      } else {
        tokens.push({ token: ch, explanation: `Literal '{'` });
        i++;
      }
    } else if (ch === '|') {
      tokens.push({ token: '|', explanation: 'OR (alternation)' });
      i++;
    } else {
      const simpleExplanation = explainToken(ch);
      tokens.push({
        token: ch,
        explanation: simpleExplanation || `Literal '${ch}'`,
      });
      i++;
    }
  }

  return tokens;
}

export function registerExplainRegex(server: McpServer, store: RegexStore): void {
  server.tool(
    'explain-regex',
    'Explain a regular expression pattern in plain language',
    {
      pattern: z.string().describe('The regex pattern to explain'),
      flags: z.string().optional().describe('Regex flags (e.g., "gi")'),
    },
    async ({ pattern, flags }) => {
      try {
        // Validate the regex
        new RegExp(pattern, flags || '');

        const tokens = tokenize(pattern);

        const flagExplanations: Record<string, string> = {
          g: 'Global - find all matches',
          i: 'Case-insensitive matching',
          m: 'Multiline - ^ and $ match line boundaries',
          s: 'Dotall - dot matches newline',
          u: 'Unicode support',
          y: 'Sticky - match from lastIndex',
          d: 'Generate indices for matches',
        };

        const flagsList = (flags || '')
          .split('')
          .filter((f) => flagExplanations[f])
          .map((f) => `  ${f}: ${flagExplanations[f]}`);

        let output = `Pattern: /${pattern}/${flags || ''}\n\n`;
        output += 'Token breakdown:\n';
        for (const t of tokens) {
          output += `  ${t.token.padEnd(15)} → ${t.explanation}\n`;
        }

        if (flagsList.length > 0) {
          output += '\nFlags:\n';
          output += flagsList.join('\n');
        }

        // Log explain operation to history
        store.logOperation({
          operation: 'explain',
          pattern,
          flags: flags || '',
          result: { tokens, flags: flagsList },
        });

        return {
          content: [{ type: 'text' as const, text: output }],
        };
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
    },
  );
}
