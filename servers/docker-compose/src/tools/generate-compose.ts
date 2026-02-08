/**
 * Tool: generate-compose
 * Generate a docker-compose.yml from a service description.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DockerStore } from '../services/docker-store.js';

interface ServiceDefinition {
  name: string;
  image: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function generateComposeYaml(services: ServiceDefinition[]): string {
  const lines: string[] = [];

  lines.push('services:');

  for (const service of services) {
    lines.push(`${indent(1)}${service.name}:`);
    lines.push(`${indent(2)}image: ${service.image}`);

    if (service.ports && service.ports.length > 0) {
      lines.push(`${indent(2)}ports:`);
      for (const port of service.ports) {
        lines.push(`${indent(3)}- "${port}"`);
      }
    }

    if (service.environment && Object.keys(service.environment).length > 0) {
      lines.push(`${indent(2)}environment:`);
      for (const [key, value] of Object.entries(service.environment)) {
        lines.push(`${indent(3)}${key}: "${value}"`);
      }
    }

    if (service.volumes && service.volumes.length > 0) {
      lines.push(`${indent(2)}volumes:`);
      for (const vol of service.volumes) {
        lines.push(`${indent(3)}- ${vol}`);
      }
    }

    // Add a restart policy by default
    lines.push(`${indent(2)}restart: unless-stopped`);

    lines.push('');
  }

  // Collect named volumes (those that look like named volumes, not bind mounts)
  const namedVolumes: string[] = [];
  for (const service of services) {
    if (service.volumes) {
      for (const vol of service.volumes) {
        const parts = vol.split(':');
        // Named volume: doesn't start with . or /
        if (parts.length >= 2 && !parts[0].startsWith('.') && !parts[0].startsWith('/')) {
          const volName = parts[0];
          if (!namedVolumes.includes(volName)) {
            namedVolumes.push(volName);
          }
        }
      }
    }
  }

  if (namedVolumes.length > 0) {
    lines.push('volumes:');
    for (const vol of namedVolumes) {
      lines.push(`${indent(1)}${vol}:`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function registerGenerateCompose(server: McpServer, store: DockerStore): void {
  server.tool(
    'generate-compose',
    'Generate a docker-compose.yml file from a list of service definitions',
    {
      services: z
        .array(
          z.object({
            name: z.string().describe('Service name'),
            image: z.string().describe('Docker image (e.g., "nginx:1.25-alpine")'),
            ports: z
              .array(z.string())
              .optional()
              .describe('Port mappings (e.g., ["8080:80", "443:443"])'),
            environment: z
              .record(z.string())
              .optional()
              .describe('Environment variables as key-value pairs'),
            volumes: z
              .array(z.string())
              .optional()
              .describe('Volume mounts (e.g., ["data:/var/lib/data", "./config:/etc/config"])'),
          }),
        )
        .describe('Array of service definitions'),
    },
    async ({ services }) => {
      try {
        if (services.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No services provided. Please provide at least one service definition.',
              },
            ],
            isError: true,
          };
        }

        const yaml = generateComposeYaml(services);

        // Persist the generated compose to the store
        const serviceNames = services.map((s) => s.name);
        store.saveGenerated({
          name: serviceNames.join(', '),
          services: serviceNames,
          output: yaml,
        });

        return {
          content: [{ type: 'text' as const, text: yaml }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate compose file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
