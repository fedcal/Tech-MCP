/**
 * Structured logger for MCP Suite servers.
 * Uses stderr to avoid interfering with STDIO transport on stdout.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: number;

  constructor(
    private readonly name: string,
    level: LogLevel = 'info',
  ) {
    this.level = LOG_LEVELS[level];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      server: this.name,
      message,
      ...data,
    };

    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}
