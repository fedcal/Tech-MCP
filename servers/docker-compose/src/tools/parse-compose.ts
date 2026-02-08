/**
 * Tool: parse-compose
 * Parse and validate a docker-compose.yml file.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { DockerStore } from '../services/docker-store.js';

interface ParsedCompose {
  services: string[];
  networks: string[];
  volumes: string[];
  serviceDetails: Record<string, Record<string, unknown>>;
  issues: string[];
}

/**
 * Simple line-based YAML parser for docker-compose files.
 * Handles top-level sections and their immediate children.
 */
function parseComposeYaml(content: string): ParsedCompose {
  const lines = content.split('\n');
  const result: ParsedCompose = {
    services: [],
    networks: [],
    volumes: [],
    serviceDetails: {},
    issues: [],
  };

  let currentTopLevel = '';
  let currentService = '';
  let currentServiceKey = '';
  let topLevelIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) {
      continue;
    }

    const indent = line.length - line.trimStart().length;

    // Top-level key (no indentation)
    if (indent === 0 && trimmed.endsWith(':')) {
      currentTopLevel = trimmed.slice(0, -1).trim();
      currentService = '';
      currentServiceKey = '';
      topLevelIndent = 0;
      continue;
    }

    // Check for top-level key with value on same line
    if (indent === 0 && trimmed.includes(':')) {
      const key = trimmed.split(':')[0].trim();
      // version, name, etc. are top-level scalar keys
      if (key === 'version') {
        // version is deprecated in modern compose
        result.issues.push(
          `Line ${i + 1}: "version" is deprecated in modern Docker Compose and can be removed.`,
        );
      }
      currentTopLevel = key;
      currentService = '';
      topLevelIndent = 0;
      continue;
    }

    // Children of top-level sections
    if (currentTopLevel && indent > topLevelIndent) {
      // Direct child of the top-level section (e.g., service name, network name)
      const childKeyMatch = trimmed.match(/^(\s*)(\S[^:]*)\s*:/);
      if (childKeyMatch) {
        const childIndent = childKeyMatch[1].length;

        if (currentTopLevel === 'services') {
          // Detect service-level vs property-level entries
          if (currentService === '' || childIndent <= 2) {
            const serviceName = childKeyMatch[2].trim();
            // Only treat as a service name if it's a direct child (indent 2)
            if (childIndent <= 2) {
              currentService = serviceName;
              currentServiceKey = '';
              if (!result.services.includes(serviceName)) {
                result.services.push(serviceName);
                result.serviceDetails[serviceName] = {};
              }
              continue;
            }
          }

          // Property of a service
          if (currentService && childIndent > 2) {
            const propKey = childKeyMatch[2].trim();
            const colonIndex = trimmed.indexOf(':');
            const propValue = trimmed.slice(colonIndex + 1).trim();
            currentServiceKey = propKey;

            if (propValue) {
              result.serviceDetails[currentService][propKey] = propValue;
            } else {
              // Value likely on subsequent indented lines (list or mapping)
              result.serviceDetails[currentService][propKey] = [];
            }

            // Validate known properties
            validateServiceProperty(currentService, propKey, propValue, i + 1, result);
            continue;
          }
        } else if (currentTopLevel === 'networks') {
          if (childIndent <= 2) {
            const networkName = childKeyMatch[2].trim();
            if (!result.networks.includes(networkName)) {
              result.networks.push(networkName);
            }
          }
        } else if (currentTopLevel === 'volumes') {
          if (childIndent <= 2) {
            const volumeName = childKeyMatch[2].trim();
            if (!result.volumes.includes(volumeName)) {
              result.volumes.push(volumeName);
            }
          }
        }
      }

      // List item (starts with -)
      const listItemMatch = trimmed.match(/^\s*-\s*(.*)/);
      if (listItemMatch && currentService && currentServiceKey) {
        const value = listItemMatch[1].trim();
        const existing = result.serviceDetails[currentService][currentServiceKey];
        if (Array.isArray(existing)) {
          existing.push(value);
        }
      }
    }
  }

  // Post-parse validation
  if (result.services.length === 0) {
    result.issues.push('No services found in the compose file.');
  }

  for (const service of result.services) {
    const details = result.serviceDetails[service];
    if (!details['image'] && !details['build']) {
      result.issues.push(
        `Service "${service}": missing both "image" and "build". At least one is required.`,
      );
    }
  }

  return result;
}

function validateServiceProperty(
  service: string,
  key: string,
  value: string,
  lineNum: number,
  result: ParsedCompose,
): void {
  // Check for :latest tag
  if (key === 'image' && value && (value.endsWith(':latest') || (!value.includes(':') && value !== ''))) {
    result.issues.push(
      `Line ${lineNum}: Service "${service}" uses image "${value}" without a specific tag. Consider pinning a version.`,
    );
  }

  // Check for privileged mode
  if (key === 'privileged' && value === 'true') {
    result.issues.push(
      `Line ${lineNum}: Service "${service}" runs in privileged mode. This is a security risk.`,
    );
  }

  // Check for network_mode: host
  if (key === 'network_mode' && value === 'host') {
    result.issues.push(
      `Line ${lineNum}: Service "${service}" uses host network mode. Consider using a custom network.`,
    );
  }
}

export function registerParseCompose(server: McpServer, store: DockerStore): void {
  server.tool(
    'parse-compose',
    'Parse and validate a docker-compose.yml file, extracting services, networks, volumes, and issues',
    {
      filePath: z.string().describe('Path to the docker-compose.yml file'),
    },
    async ({ filePath }) => {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const parsed = parseComposeYaml(content);

        const output = {
          filePath,
          services: parsed.services,
          serviceCount: parsed.services.length,
          networks: parsed.networks,
          volumes: parsed.volumes,
          serviceDetails: parsed.serviceDetails,
          validationIssues: parsed.issues,
          hasIssues: parsed.issues.length > 0,
        };

        // Persist the analysis to the store
        store.saveAnalysis({
          filePath,
          serviceCount: parsed.services.length,
          services: parsed.services,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to parse compose file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
