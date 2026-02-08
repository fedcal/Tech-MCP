/**
 * Tool: extract-endpoints
 * Extract API endpoints from source code by scanning for Express-style or decorator-based route definitions.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EventBus } from '@mcp-suite/core';
import type { DocsStore } from '../services/docs-store.js';

interface Endpoint {
  method: string;
  path: string;
  handlerName: string;
  lineNumber: number;
}

function extractExpressRoutes(content: string): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const lines = content.split('\n');

  // Match: app.get('/path', handler) or router.post('/path', handler)
  // Also matches: app.get('/path', middleware, handler)
  const expressRouteRegex =
    /(?:app|router|route)\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:[^,)]+,\s*)*(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(expressRouteRegex);
    if (match) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        handlerName: match[3],
        lineNumber: i + 1,
      });
      continue;
    }

    // Match inline handler: app.get('/path', (req, res) => { ... })
    const inlineRegex =
      /(?:app|router|route)\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]\s*,/;
    const inlineMatch = lines[i].match(inlineRegex);
    if (inlineMatch) {
      // Try to find the function name from the line or use 'anonymous'
      const arrowOrFunc = lines[i].match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\(/) || null;
      endpoints.push({
        method: inlineMatch[1].toUpperCase(),
        path: inlineMatch[2],
        handlerName: arrowOrFunc ? arrowOrFunc[1] : '(inline)',
        lineNumber: i + 1,
      });
    }
  }

  return endpoints;
}

function extractDecoratorRoutes(content: string): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const lines = content.split('\n');

  // Match: @Get('/path'), @Post('/path'), etc. (NestJS / class-based decorators)
  const decoratorRegex = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(decoratorRegex);
    if (match) {
      // Look ahead for the method name
      let handlerName = '(unknown)';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const methodMatch = lines[j].match(
          /(?:async\s+)?(\w+)\s*\(/
        );
        if (methodMatch) {
          handlerName = methodMatch[1];
          break;
        }
      }

      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2] || '/',
        handlerName,
        lineNumber: i + 1,
      });
    }
  }

  return endpoints;
}

function extractControllerPrefix(content: string): string | null {
  // Match: @Controller('/prefix') or @Controller('prefix')
  const match = content.match(/@Controller\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  return match ? match[1] : null;
}

export function registerExtractEndpoints(server: McpServer, store: DocsStore, eventBus?: EventBus): void {
  server.tool(
    'extract-endpoints',
    'Extract API endpoints from source code by scanning for Express-style route definitions or decorator patterns (@Get, @Post, etc.)',
    {
      filePath: z.string().describe('Path to the source file to scan for endpoints'),
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

        const expressEndpoints = extractExpressRoutes(content);
        const decoratorEndpoints = extractDecoratorRoutes(content);

        // Apply controller prefix to decorator endpoints
        const controllerPrefix = extractControllerPrefix(content);
        if (controllerPrefix) {
          for (const ep of decoratorEndpoints) {
            const prefix = controllerPrefix.endsWith('/') ? controllerPrefix.slice(0, -1) : controllerPrefix;
            const epPath = ep.path.startsWith('/') ? ep.path : '/' + ep.path;
            ep.path = prefix + epPath;
          }
        }

        const allEndpoints = [...expressEndpoints, ...decoratorEndpoints];

        // Publish summary event with the first endpoint found
        if (allEndpoints.length > 0) {
          const first = allEndpoints[0];
          eventBus?.publish('docs:api-updated', {
            endpoint: first.path,
            method: first.method,
            changes: allEndpoints.map((ep) => `${ep.method} ${ep.path}`),
          });
        }

        const result = {
          filePath: resolvedPath,
          fileName: path.basename(resolvedPath),
          totalEndpoints: allEndpoints.length,
          endpoints: allEndpoints,
          controllerPrefix: controllerPrefix || null,
        };

        // Persist extracted spec summary
        store.saveSpec({
          title: path.basename(resolvedPath),
          version: '0.0.0',
          endpointCount: allEndpoints.length,
          spec: result as unknown as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error extracting endpoints: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
