#!/usr/bin/env node

/**
 * MCP Suite CLI - Manage MCP Suite servers.
 */

import { Command } from 'commander';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const SERVERS_DIR = join(ROOT, 'servers');

const program = new Command();

program
  .name('mcp-suite')
  .description('CLI tool for managing MCP Suite servers')
  .version('0.1.0');

program
  .command('list')
  .description('List all available MCP Suite servers')
  .action(() => {
    const servers = getAvailableServers();
    console.log('\nAvailable MCP Suite servers:\n');
    for (const server of servers) {
      console.log(`  - ${server}`);
    }
    console.log(`\nTotal: ${servers.length} servers\n`);
  });

program
  .command('start <server>')
  .description('Start an MCP Suite server')
  .option('-t, --transport <type>', 'Transport type (stdio|http)', 'stdio')
  .action((server: string, opts: { transport: string }) => {
    const serverDir = join(SERVERS_DIR, server);
    const entryPoint = join(serverDir, 'dist', 'index.js');

    if (!existsSync(entryPoint)) {
      console.error(`Server '${server}' not found or not built. Run 'pnpm build' first.`);
      process.exit(1);
    }

    console.log(`Starting server: ${server} (transport: ${opts.transport})`);
    const child = spawn('node', [entryPoint], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MCP_SUITE_TRANSPORT: opts.transport,
      },
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

program
  .command('status')
  .description('Show status of MCP Suite')
  .action(() => {
    const servers = getAvailableServers();
    const built = servers.filter((s) => existsSync(join(SERVERS_DIR, s, 'dist', 'index.js')));
    const notBuilt = servers.filter((s) => !existsSync(join(SERVERS_DIR, s, 'dist', 'index.js')));

    console.log('\nMCP Suite Status:\n');
    console.log(`  Total servers: ${servers.length}`);
    console.log(`  Built: ${built.length}`);
    console.log(`  Not built: ${notBuilt.length}`);

    if (built.length > 0) {
      console.log('\n  Built servers:');
      for (const s of built) console.log(`    ✓ ${s}`);
    }

    if (notBuilt.length > 0) {
      console.log('\n  Not built:');
      for (const s of notBuilt) console.log(`    ✗ ${s}`);
    }
    console.log('');
  });

function getAvailableServers(): string[] {
  if (!existsSync(SERVERS_DIR)) return [];
  return readdirSync(SERVERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

program.parse();
