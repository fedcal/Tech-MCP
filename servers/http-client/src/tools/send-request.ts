/**
 * Tool: send-request
 * Executes an HTTP request using Node.js native fetch() and returns the response.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HttpStore } from '../services/http-store.js';

export function registerSendRequest(server: McpServer, store: HttpStore): void {
  server.tool(
    'send-request',
    'Execute an HTTP request and return the response with status, headers, body, and duration',
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
      timeoutMs: z
        .number()
        .positive()
        .optional()
        .default(30000)
        .describe('Request timeout in milliseconds (default: 30000)'),
    },
    async ({ method, url, headers, body, queryParams, timeoutMs }) => {
      try {
        // Build URL with query params
        const requestUrl = new URL(url);
        if (queryParams) {
          for (const [key, value] of Object.entries(queryParams)) {
            requestUrl.searchParams.append(key, value);
          }
        }

        // Prepare request options
        const requestHeaders: Record<string, string> = { ...headers };
        let requestBody: string | undefined;

        if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
          if (typeof body === 'object') {
            requestBody = JSON.stringify(body);
            if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
              requestHeaders['Content-Type'] = 'application/json';
            }
          } else {
            requestBody = body;
          }
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Measure duration
        const startTime = performance.now();

        let response: Response;
        try {
          response = await fetch(requestUrl.toString(), {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal: controller.signal,
            redirect: 'follow',
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const endTime = performance.now();
        const durationMs = Math.round((endTime - startTime) * 100) / 100;

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Read and try to parse response body
        const rawBody = method === 'HEAD' ? '' : await response.text();
        let parsedBody: unknown = rawBody;
        try {
          if (rawBody) {
            parsedBody = JSON.parse(rawBody);
          }
        } catch {
          // Body is not JSON, keep as raw text
        }

        // Log request to store
        try {
          store.logRequest({
            method,
            url: requestUrl.toString(),
            headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : null,
            body: requestBody ?? null,
            statusCode: response.status,
            statusText: response.statusText,
            responseHeaders: Object.keys(responseHeaders).length > 0 ? responseHeaders : null,
            responseBody: rawBody || null,
            durationMs,
          });
        } catch {
          // Storage failure should not break the tool
        }

        const result = {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: parsedBody,
          durationMs,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'Request timed out',
                    timeoutMs,
                    url,
                    method,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: 'Request failed',
                  message: errorMessage,
                  url,
                  method,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
