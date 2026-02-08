/**
 * Tool: generate-openapi
 * Generate an OpenAPI 3.0 skeleton from a list of endpoint definitions.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DocsStore } from '../services/docs-store.js';

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  summary: string;
  operationId: string;
  responses: Record<string, { description: string }>;
  tags?: string[];
}

function sanitizeOperationId(method: string, routePath: string): string {
  const parts = routePath
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(':') || part.startsWith('{')) {
        return 'By' + capitalize(part.replace(/[:{}]/g, ''));
      }
      return capitalize(part);
    });

  return method.toLowerCase() + parts.join('');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function convertToOpenApiPath(routePath: string): string {
  // Convert Express-style :param to OpenAPI {param}
  return routePath.replace(/:(\w+)/g, '{$1}');
}

function extractPathParameters(routePath: string): string[] {
  const params: string[] = [];
  const regex = /[:{](\w+)}?/g;
  let match;
  while ((match = regex.exec(routePath)) !== null) {
    params.push(match[1]);
  }
  return params;
}

export function registerGenerateOpenapi(server: McpServer, store: DocsStore): void {
  server.tool(
    'generate-openapi',
    'Generate an OpenAPI 3.0 skeleton specification from a list of endpoint definitions',
    {
      endpoints: z
        .array(
          z.object({
            method: z.string().describe('HTTP method (GET, POST, PUT, DELETE, etc.)'),
            path: z.string().describe('Route path (e.g. /users/:id)'),
            description: z.string().optional().describe('Description of the endpoint'),
          }),
        )
        .describe('Array of endpoint definitions'),
      title: z.string().describe('API title'),
      version: z.string().describe('API version (e.g. 1.0.0)'),
    },
    async ({ endpoints, title, version }) => {
      try {
        const spec: OpenApiSpec = {
          openapi: '3.0.3',
          info: {
            title,
            version,
            description: `API specification for ${title}`,
          },
          paths: {},
        };

        for (const endpoint of endpoints) {
          const openApiPath = convertToOpenApiPath(endpoint.path);
          const method = endpoint.method.toLowerCase();
          const operationId = sanitizeOperationId(method, endpoint.path);
          const pathParams = extractPathParameters(endpoint.path);

          if (!spec.paths[openApiPath]) {
            spec.paths[openApiPath] = {};
          }

          const operation: OpenApiOperation & { parameters?: Array<Record<string, unknown>> } = {
            summary: endpoint.description || `${endpoint.method} ${endpoint.path}`,
            operationId,
            responses: {
              '200': { description: 'Successful operation' },
              '400': { description: 'Bad request' },
              '404': { description: 'Not found' },
              '500': { description: 'Internal server error' },
            },
          };

          // Extract tags from path
          const pathParts = endpoint.path.split('/').filter(Boolean);
          if (pathParts.length > 0 && !pathParts[0].startsWith(':')) {
            operation.tags = [pathParts[0]];
          }

          // Add path parameters
          if (pathParams.length > 0) {
            operation.parameters = pathParams.map((param) => ({
              name: param,
              in: 'path',
              required: true,
              schema: { type: 'string' },
            }));
          }

          // Add request body placeholder for POST/PUT/PATCH
          if (['post', 'put', 'patch'].includes(method)) {
            (operation as unknown as Record<string, unknown>).requestBody = {
              description: 'Request body',
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            };
          }

          spec.paths[openApiPath][method] = operation;
        }

        // Persist generated spec
        store.saveSpec({
          title,
          version,
          endpointCount: endpoints.length,
          spec: spec as unknown as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(spec, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
