/**
 * Tool: convert-regex
 * Converts regex between different language flavors.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegexStore } from '../services/regex-store.js';

type Flavor = 'javascript' | 'python' | 'go' | 'java' | 'rust' | 'pcre';

interface ConversionNote {
  type: 'info' | 'warning';
  message: string;
}

function convertRegex(
  pattern: string,
  flags: string,
  from: Flavor,
  to: Flavor,
): { pattern: string; flags: string; notes: ConversionNote[]; usage: string } {
  const notes: ConversionNote[] = [];
  let newPattern = pattern;
  let newFlags = flags;

  // Lookahead/lookbehind support
  if (to === 'go' && (/\(\?<=/.test(pattern) || /\(\?<!/.test(pattern))) {
    notes.push({
      type: 'warning',
      message: 'Go does not support lookbehind assertions. Pattern may not work.',
    });
  }

  // Named groups: (?P<name>) (Python) vs (?<name>) (JS/Java)
  if (from === 'python' && (to === 'javascript' || to === 'java')) {
    newPattern = newPattern.replace(/\(\?P</g, '(?<');
    newPattern = newPattern.replace(/\(\?P=/g, '\\k<');
    notes.push({ type: 'info', message: 'Converted Python named groups (?P<name>) to (?<name>)' });
  }

  if ((from === 'javascript' || from === 'java') && to === 'python') {
    newPattern = newPattern.replace(/\(\?<(?!=)(?!!)/g, '(?P<');
    notes.push({ type: 'info', message: 'Converted named groups (?<name>) to Python (?P<name>)' });
  }

  // Flag conversion
  const flagMap: Record<Flavor, Record<string, string>> = {
    javascript: { g: 'global', i: 'ignoreCase', m: 'multiline', s: 'dotAll', u: 'unicode' },
    python: { g: 're.FINDALL', i: 're.IGNORECASE', m: 're.MULTILINE', s: 're.DOTALL' },
    go: { i: '(?i)', m: '(?m)', s: '(?s)' },
    java: { i: 'CASE_INSENSITIVE', m: 'MULTILINE', s: 'DOTALL' },
    rust: { i: '(?i)', m: '(?m)', s: '(?s)' },
    pcre: { g: 'g', i: 'i', m: 'm', s: 's', u: 'u' },
  };

  if (to === 'go' && flags.includes('g')) {
    notes.push({
      type: 'info',
      message: "Go doesn't have a global flag. Use FindAllString/FindAllStringSubmatch instead.",
    });
    newFlags = newFlags.replace('g', '');
  }

  // Generate usage string
  let usage: string;
  switch (to) {
    case 'javascript':
      usage = `const regex = /${newPattern}/${newFlags};\nconst matches = str.match(regex);`;
      break;
    case 'python':
      usage = `import re\npattern = re.compile(r'${newPattern}'${flags.includes('i') ? ', re.IGNORECASE' : ''})\nmatches = pattern.findall(text)`;
      break;
    case 'go':
      usage = `re := regexp.MustCompile(\`${newPattern}\`)\nmatches := re.FindAllString(text, -1)`;
      break;
    case 'java':
      usage = `Pattern pattern = Pattern.compile("${newPattern.replace(/\\/g, '\\\\')}"${flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : ''});\nMatcher matcher = pattern.matcher(text);`;
      break;
    case 'rust':
      usage = `let re = Regex::new(r"${newPattern}").unwrap();\nlet matches: Vec<&str> = re.find_iter(text).map(|m| m.as_str()).collect();`;
      break;
    default:
      usage = `/${newPattern}/${newFlags}`;
  }

  return { pattern: newPattern, flags: newFlags, notes, usage };
}

export function registerConvertRegex(server: McpServer, store: RegexStore): void {
  server.tool(
    'convert-regex',
    'Convert a regex pattern between different language flavors',
    {
      pattern: z.string().describe('The regex pattern to convert'),
      flags: z.string().optional().describe('Current flags'),
      from: z
        .enum(['javascript', 'python', 'go', 'java', 'rust', 'pcre'])
        .describe('Source language flavor'),
      to: z
        .enum(['javascript', 'python', 'go', 'java', 'rust', 'pcre'])
        .describe('Target language flavor'),
    },
    async ({ pattern, flags, from, to }) => {
      if (from === to) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Source and target flavors are the same. No conversion needed.',
            },
          ],
        };
      }

      const result = convertRegex(pattern, flags || '', from, to);

      const convertResult = {
        from,
        to,
        original: { pattern, flags: flags || '' },
        converted: { pattern: result.pattern, flags: result.flags },
        usage: result.usage,
        notes: result.notes,
      };

      // Log convert operation to history
      store.logOperation({
        operation: 'convert',
        pattern,
        flags: flags || '',
        result: convertResult,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(convertResult, null, 2),
          },
        ],
      };
    },
  );
}
