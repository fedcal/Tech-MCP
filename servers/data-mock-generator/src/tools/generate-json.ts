/**
 * Tool: generate-json
 * Generates mock JSON data matching a JSON Schema definition.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getGenerator, type GeneratorFn } from '../services/generators.js';
import {
  firstName,
  lastName,
  email,
  phone,
  url,
  uuid,
  ipv4,
  date,
  integer,
  float,
  boolean as booleanGen,
  sentence,
  paragraph,
  hexColor,
  address,
  company,
} from '../services/generators.js';
import type { MockStore } from '../services/mock-store.js';

/**
 * Maps a JSON Schema property definition to a generator function.
 * Uses the "format" hint when available, then falls back to the "type".
 */
function resolveGenerator(property: {
  type?: string;
  format?: string;
}): GeneratorFn | undefined {
  // Check format first for more specific generators
  if (property.format) {
    const formatGen = getGenerator(property.format);
    if (formatGen) {
      return formatGen;
    }

    // Map well-known JSON Schema formats
    switch (property.format) {
      case 'email':
        return email;
      case 'uri':
      case 'url':
        return url;
      case 'uuid':
        return uuid;
      case 'ipv4':
        return ipv4;
      case 'date':
      case 'date-time':
        return date;
      case 'phone':
        return phone;
      case 'first-name':
      case 'firstName':
        return firstName;
      case 'last-name':
      case 'lastName':
        return lastName;
      case 'address':
        return address;
      case 'company':
        return company;
      case 'sentence':
        return sentence;
      case 'paragraph':
        return paragraph;
      case 'hex-color':
      case 'hexColor':
        return hexColor;
    }
  }

  // Fall back to type-based generators
  switch (property.type) {
    case 'string':
      return sentence;
    case 'number':
      return float;
    case 'integer':
      return integer;
    case 'boolean':
      return booleanGen;
    default:
      return undefined;
  }
}

export function registerGenerateJson(server: McpServer, store: MockStore): void {
  server.tool(
    'generate-json',
    'Generate mock JSON data matching a JSON Schema with properties, types, and optional format hints',
    {
      jsonSchema: z
        .object({
          properties: z.record(
            z.object({
              type: z.string().optional().describe('JSON Schema type (string, number, integer, boolean)'),
              format: z
                .string()
                .optional()
                .describe(
                  'Format hint to select a specific generator (e.g., email, uuid, firstName, date)',
                ),
            }),
          ),
        })
        .describe('A JSON Schema object with a "properties" map'),
      count: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(10)
        .describe('Number of objects to generate (default: 10, max: 10000)'),
      name: z
        .string()
        .optional()
        .describe('Optional name for the generated dataset (used for storage)'),
    },
    async ({ jsonSchema, count, name }) => {
      try {
        const properties = jsonSchema.properties;
        const fieldNames = Object.keys(properties);

        // Resolve generators for each property
        const fieldGenerators: Array<{
          field: string;
          generate: GeneratorFn;
        }> = [];

        const unmapped: string[] = [];

        for (const field of fieldNames) {
          const prop = properties[field];
          const gen = resolveGenerator(prop);
          if (gen) {
            fieldGenerators.push({ field, generate: gen });
          } else {
            unmapped.push(field);
          }
        }

        if (unmapped.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Could not resolve generators for properties: ${unmapped.join(', ')}. Provide a valid "type" (string, number, integer, boolean) or "format" hint.`,
              },
            ],
            isError: true,
          };
        }

        // Generate objects
        const rows: Record<string, string | number | boolean>[] = [];
        for (let i = 0; i < count; i++) {
          const row: Record<string, string | number | boolean> = {};
          for (const fg of fieldGenerators) {
            row[fg.field] = fg.generate();
          }
          rows.push(row);
        }

        // Persist to store
        const schemaFields = fieldNames.map((f) => ({
          field: f,
          type: properties[f].type ?? 'unknown',
          format: properties[f].format,
        }));
        const sampleData = rows.slice(0, 5);
        store.saveDataset({
          name: name ?? `json-data-${Date.now()}`,
          schema: schemaFields,
          format: 'json-schema',
          rowCount: rows.length,
          sampleData,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating JSON: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
