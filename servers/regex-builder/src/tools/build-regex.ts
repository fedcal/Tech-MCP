/**
 * Tool: build-regex
 * Builds a regex pattern from a structured description.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RegexStore } from '../services/regex-store.js';

const COMMON_PATTERNS: Record<string, { pattern: string; description: string }> = {
  email: {
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    description: 'Email address',
  },
  url: {
    pattern: 'https?://[\\w.-]+(?:\\.[\\w.-]+)+[\\w.,@?^=%&:/~+#-]*',
    description: 'HTTP/HTTPS URL',
  },
  ipv4: {
    pattern: '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)',
    description: 'IPv4 address',
  },
  phone: {
    pattern: '\\+?\\d{1,3}[-.\\s]?\\(?\\d{1,4}\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}',
    description: 'Phone number (international)',
  },
  date_iso: {
    pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])',
    description: 'ISO date (YYYY-MM-DD)',
  },
  time_24h: {
    pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?',
    description: '24-hour time (HH:MM or HH:MM:SS)',
  },
  hex_color: {
    pattern: '#(?:[0-9a-fA-F]{3}){1,2}',
    description: 'Hex color code',
  },
  uuid: {
    pattern:
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    description: 'UUID v4',
  },
  slug: {
    pattern: '[a-z0-9]+(?:-[a-z0-9]+)*',
    description: 'URL slug',
  },
  semver: {
    pattern: '\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9.]+)?(?:\\+[a-zA-Z0-9.]+)?',
    description: 'Semantic version',
  },
};

export function registerBuildRegex(server: McpServer, store: RegexStore): void {
  server.tool(
    'build-regex',
    'Build a regex from a common pattern name or a natural language description',
    {
      description: z
        .string()
        .describe(
          'What the regex should match. Can be a common pattern name (email, url, ipv4, phone, date_iso, time_24h, hex_color, uuid, slug, semver) or a description',
        ),
      anchorStart: z.boolean().optional().describe('Whether to anchor to start of string (^)'),
      anchorEnd: z.boolean().optional().describe('Whether to anchor to end of string ($)'),
      captureGroups: z.boolean().optional().describe('Whether to wrap in a capturing group'),
      flags: z.string().optional().describe('Suggested flags'),
    },
    async ({ description, anchorStart, anchorEnd, captureGroups, flags }) => {
      const key = description.toLowerCase().replace(/\s+/g, '_');
      const common = COMMON_PATTERNS[key];

      let pattern: string;
      let desc: string;

      if (common) {
        pattern = common.pattern;
        desc = common.description;
      } else {
        // For non-common patterns, provide guidance
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `No built-in pattern found for '${description}'.`,
                  availablePatterns: Object.entries(COMMON_PATTERNS).map(([name, p]) => ({
                    name,
                    description: p.description,
                    pattern: p.pattern,
                  })),
                  tip: 'Use test-regex to validate a custom pattern, or explain-regex to understand an existing one.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (captureGroups) pattern = `(${pattern})`;
      if (anchorStart) pattern = `^${pattern}`;
      if (anchorEnd) pattern = `${pattern}$`;

      // Validate
      try {
        new RegExp(pattern, flags || '');
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Generated pattern is invalid: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }

      const buildResult = {
        pattern,
        flags: flags || '',
        description: desc,
        fullRegex: `/${pattern}/${flags || ''}`,
        jsUsage: `const regex = new RegExp('${pattern.replace(/\\/g, '\\\\')}', '${flags || ''}');`,
      };

      // Log build operation to history
      store.logOperation({
        operation: 'build',
        pattern,
        flags: flags || '',
        result: buildResult,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(buildResult, null, 2),
          },
        ],
      };
    },
  );
}
