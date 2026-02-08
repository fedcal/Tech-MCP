/**
 * Tool: generate-curl
 * Generates a curl command from HTTP request parameters.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HttpStore } from '../services/http-store.js';

function shellEscape(str: string): string {
  // Wrap in single quotes and escape any single quotes within
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

export function registerGenerateCurl(server: McpServer, _store: HttpStore): void {
  server.tool(
    'generate-curl',
    'Generate a curl command string from HTTP request parameters',
    {
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      url: z.string().url().describe('The request URL'),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe('Request headers as key-value pairs'),
      body: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .optional()
        .describe('Request body (string or JSON object)'),
      queryParams: z
        .record(z.string(), z.string())
        .optional()
        .describe('Query parameters as key-value pairs'),
      followRedirects: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include -L flag to follow redirects (default: true)'),
      verbose: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include -v flag for verbose output (default: false)'),
      insecure: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include -k flag to skip SSL verification (default: false)'),
    },
    async ({ method, url, headers, body, queryParams, followRedirects, verbose, insecure }) => {
      try {
        // Build URL with query params
        const requestUrl = new URL(url);
        if (queryParams) {
          for (const [key, value] of Object.entries(queryParams)) {
            requestUrl.searchParams.append(key, value);
          }
        }

        const parts: string[] = ['curl'];

        // Method
        if (method !== 'GET') {
          parts.push('-X', method);
        }

        // Flags
        if (followRedirects) {
          parts.push('-L');
        }
        if (verbose) {
          parts.push('-v');
        }
        if (insecure) {
          parts.push('-k');
        }

        // URL
        parts.push(shellEscape(requestUrl.toString()));

        // Headers
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            parts.push('-H', shellEscape(`${key}: ${value}`));
          }
        }

        // Body
        if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
          const bodyStr = typeof body === 'object' ? JSON.stringify(body) : body;
          parts.push('-d', shellEscape(bodyStr));

          // Auto-add Content-Type for JSON bodies if not present
          if (typeof body === 'object' && !headers?.['Content-Type'] && !headers?.['content-type']) {
            parts.push('-H', shellEscape('Content-Type: application/json'));
          }
        }

        const curlCommand = parts.join(' \\\n  ');
        const curlOneLine = parts.join(' ');

        const result = {
          curl: curlCommand,
          curlOneLine,
          method,
          url: requestUrl.toString(),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate curl command: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
