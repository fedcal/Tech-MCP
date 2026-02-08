/**
 * Configuration loader for MCP Suite servers.
 * Loads config from environment variables with pattern MCP_SUITE_<SERVER>_<FIELD>.
 */

import { z } from 'zod';

export const ServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'http']).default('stdio'),
  port: z.number().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  dataDir: z.string().optional(),
  eventBus: z
    .object({
      type: z.enum(['local', 'redis']).default('local'),
      redisUrl: z.string().optional(),
    })
    .default({ type: 'local' }),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

function envKey(serverName: string, field: string): string {
  const prefix = serverName.replace(/-/g, '_').toUpperCase();
  return `MCP_SUITE_${prefix}_${field.toUpperCase()}`;
}

export function loadConfig(serverName: string, overrides?: Partial<ServerConfig>): ServerConfig {
  const raw: Record<string, unknown> = {};

  const transport = process.env[envKey(serverName, 'TRANSPORT')] || process.env.MCP_SUITE_TRANSPORT;
  if (transport) raw.transport = transport;

  const port = process.env[envKey(serverName, 'PORT')] || process.env.MCP_SUITE_PORT;
  if (port) raw.port = parseInt(port, 10);

  const logLevel =
    process.env[envKey(serverName, 'LOG_LEVEL')] || process.env.MCP_SUITE_LOG_LEVEL;
  if (logLevel) raw.logLevel = logLevel;

  const dataDir = process.env[envKey(serverName, 'DATA_DIR')] || process.env.MCP_SUITE_DATA_DIR;
  if (dataDir) raw.dataDir = dataDir;

  const eventBusType =
    process.env[envKey(serverName, 'EVENT_BUS_TYPE')] || process.env.MCP_SUITE_EVENT_BUS_TYPE;
  const redisUrl =
    process.env[envKey(serverName, 'REDIS_URL')] || process.env.MCP_SUITE_REDIS_URL;
  if (eventBusType || redisUrl) {
    raw.eventBus = {
      type: eventBusType || 'local',
      ...(redisUrl ? { redisUrl } : {}),
    };
  }

  const merged = { ...raw, ...overrides };
  return ServerConfigSchema.parse(merged);
}
