/**
 * Tool: benchmark-compare
 * Generates benchmark comparison templates for two code snippets.
 * For safety, does not eval code - returns a runnable benchmark setup instead.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventBus } from '@mcp-suite/core';
import type { ProfilerStore } from '../services/profiler-store.js';

function generateBenchmarkTemplate(
  codeA: string,
  codeB: string,
  iterations: number,
): string {
  const template = `// =============================================================
// Benchmark Comparison Template
// =============================================================
// Copy this code into a file and run it with Node.js or
// in a test runner to compare the performance of two snippets.
// =============================================================

const { performance } = require('perf_hooks');
// Or for ESM: import { performance } from 'node:perf_hooks';

const ITERATIONS = ${iterations};

// --- Snippet A ---
function snippetA() {
${codeA
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
}

// --- Snippet B ---
function snippetB() {
${codeB
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
}

// --- Benchmark Runner ---
function runBenchmark(name, fn, iterations) {
  // Warmup phase
  const warmupIterations = Math.min(100, Math.floor(iterations / 10));
  for (let i = 0; i < warmupIterations; i++) {
    fn();
  }

  // Measurement phase
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Statistics
  times.sort((a, b) => a - b);
  const total = times.reduce((sum, t) => sum + t, 0);
  const mean = total / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  // Standard deviation
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name,
    iterations,
    total: total.toFixed(4) + ' ms',
    mean: mean.toFixed(6) + ' ms',
    median: median.toFixed(6) + ' ms',
    min: min.toFixed(6) + ' ms',
    max: max.toFixed(6) + ' ms',
    p95: p95.toFixed(6) + ' ms',
    p99: p99.toFixed(6) + ' ms',
    stdDev: stdDev.toFixed(6) + ' ms',
    opsPerSecond: Math.round(1000 / mean),
  };
}

// --- Run ---
console.log('Running benchmarks...');
console.log('Iterations:', ITERATIONS);
console.log('');

const resultA = runBenchmark('Snippet A', snippetA, ITERATIONS);
const resultB = runBenchmark('Snippet B', snippetB, ITERATIONS);

console.log('=== Snippet A ===');
console.table(resultA);
console.log('');
console.log('=== Snippet B ===');
console.table(resultB);
console.log('');

// --- Comparison ---
const meanA = parseFloat(resultA.mean);
const meanB = parseFloat(resultB.mean);
const faster = meanA < meanB ? 'Snippet A' : 'Snippet B';
const ratio = meanA < meanB ? (meanB / meanA).toFixed(2) : (meanA / meanB).toFixed(2);
console.log(\`Winner: \${faster} is ~\${ratio}x faster\`);
`;

  return template;
}

export function registerBenchmarkCompare(server: McpServer, eventBus: EventBus | undefined, store: ProfilerStore): void {
  server.tool(
    'benchmark-compare',
    'Generate a benchmark comparison template for two code snippets (does not eval code for safety)',
    {
      codeA: z.string().describe('First code snippet to benchmark'),
      codeB: z.string().describe('Second code snippet to benchmark'),
      iterations: z
        .number()
        .default(1000)
        .describe('Number of iterations for the benchmark (default: 1000)'),
    },
    async ({ codeA, codeB, iterations }) => {
      try {
        const template = generateBenchmarkTemplate(codeA, codeB, iterations);

        // Publish profile completed event
        eventBus?.publish('perf:profile-completed', {
          target: 'benchmark-compare',
          durationMs: 0,
          results: { iterations, snippets: 2 },
        });

        // Persist to store
        store.saveBenchmark({
          name: 'benchmark-compare',
          results: { iterations, snippets: 2, codeALength: codeA.length, codeBLength: codeB.length },
        });

        const output = [
          'NOTE: For safety, this tool generates a benchmark template rather than executing code directly.',
          'Copy the template below into a file and run it with Node.js.',
          '',
          '---',
          '',
          template,
        ].join('\n');

        return {
          content: [{ type: 'text' as const, text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating benchmark: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
