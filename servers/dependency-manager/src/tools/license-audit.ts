/**
 * Tool: license-audit
 * Reads node_modules to check licenses of installed dependencies.
 * For each dependency in package.json, reads its package.json to get the license field.
 * Flags copyleft licenses (GPL, AGPL, etc.).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DependencyStore } from '../services/dependency-store.js';

/**
 * Known copyleft license identifiers.
 */
const COPYLEFT_LICENSES = [
  'GPL',
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL',
  'AGPL-1.0',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'LGPL',
  'LGPL-2.0',
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
  'EUPL-1.1',
  'EUPL-1.2',
  'CPAL-1.0',
  'OSL-3.0',
  'CC-BY-SA-4.0',
];

/**
 * Check if a license string indicates a copyleft license.
 */
function isCopyleft(license: string): boolean {
  const normalized = license.toUpperCase().trim();
  return COPYLEFT_LICENSES.some((cl) => normalized.includes(cl.toUpperCase()));
}

interface DepLicenseInfo {
  name: string;
  version: string;
  license: string;
  copyleft: boolean;
  path: string;
}

export function registerLicenseAudit(server: McpServer, store: DependencyStore): void {
  server.tool(
    'license-audit',
    'Audit licenses of project dependencies by reading node_modules. Flags copyleft licenses (GPL, AGPL, etc.)',
    {
      projectPath: z.string().describe('Absolute path to the project directory containing package.json and node_modules'),
    },
    async ({ projectPath }) => {
      try {
        const packageJsonPath = join(projectPath, 'package.json');
        if (!existsSync(packageJsonPath)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No package.json found at ${packageJsonPath}`,
              },
            ],
            isError: true,
          };
        }

        const nodeModulesPath = join(projectPath, 'node_modules');
        if (!existsSync(nodeModulesPath)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No node_modules directory found at ${nodeModulesPath}. Run "npm install" first.`,
              },
            ],
            isError: true,
          };
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        const allDeps = [...new Set([...dependencies, ...devDependencies])];

        const licenseInfos: DepLicenseInfo[] = [];
        const notFound: string[] = [];

        for (const depName of allDeps) {
          const depPackageJsonPath = join(nodeModulesPath, depName, 'package.json');
          if (!existsSync(depPackageJsonPath)) {
            notFound.push(depName);
            continue;
          }

          try {
            const depPackageJson = JSON.parse(readFileSync(depPackageJsonPath, 'utf-8'));

            // License can be a string or an object { type, url }
            let license = 'UNKNOWN';
            if (typeof depPackageJson.license === 'string') {
              license = depPackageJson.license;
            } else if (depPackageJson.license && typeof depPackageJson.license === 'object') {
              license = depPackageJson.license.type || 'UNKNOWN';
            } else if (Array.isArray(depPackageJson.licenses)) {
              // Older format: licenses array
              license = depPackageJson.licenses
                .map((l: { type?: string } | string) => (typeof l === 'string' ? l : l.type || 'UNKNOWN'))
                .join(' OR ');
            }

            licenseInfos.push({
              name: depName,
              version: depPackageJson.version || 'unknown',
              license,
              copyleft: isCopyleft(license),
              path: depPackageJsonPath,
            });
          } catch {
            notFound.push(depName);
          }
        }

        // Group by license type
        const byLicense: Record<string, DepLicenseInfo[]> = {};
        for (const info of licenseInfos) {
          if (!byLicense[info.license]) {
            byLicense[info.license] = [];
          }
          byLicense[info.license].push(info);
        }

        // Separate copyleft flagged dependencies
        const copyleftDeps = licenseInfos.filter((info) => info.copyleft);

        const result = {
          project: packageJson.name || 'unknown',
          projectPath,
          summary: {
            totalDependenciesChecked: licenseInfos.length,
            uniqueLicenses: Object.keys(byLicense).length,
            copyleftCount: copyleftDeps.length,
            notFoundInNodeModules: notFound.length,
          },
          copyleftWarnings: copyleftDeps.map((dep) => ({
            name: dep.name,
            version: dep.version,
            license: dep.license,
          })),
          byLicense: Object.fromEntries(
            Object.entries(byLicense).map(([license, deps]) => [
              license,
              deps.map((d) => ({ name: d.name, version: d.version })),
            ]),
          ),
          notFound,
        };

        // Persist the audit result
        store.saveLicenseAudit({
          projectPath,
          packageCount: licenseInfos.length,
          results: JSON.stringify(result),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error auditing licenses: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
