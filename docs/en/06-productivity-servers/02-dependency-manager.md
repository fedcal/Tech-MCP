# Dependency Manager Server

## Overview

The **dependency-manager** server is dedicated to the management and analysis of dependencies
in a Node.js project. It solves three critical problems in modern software development:

1. **Security vulnerabilities**: dependencies may contain known flaws (CVEs)
   that expose the application to risks
2. **Unused dependencies**: packages declared in `package.json` but never imported
   increase the bundle size and the attack surface
3. **License incompatibility**: copyleft licenses (GPL, AGPL) can impose
   unwanted restrictions on software distribution

```
+--------------------------------------------------------+
|            dependency-manager server                   |
|                                                        |
|  +---------------------------------------------------+ |
|  |                Tool Layer                         | |
|  |                                                   | |
|  |  check-vulnerabilities  find-unused               | |
|  |  license-audit                                    | |
|  +---------------------------------------------------+ |
|            |                       |                   |
|            v                       v                   |
|  +------------------+   +----------------------+       |
|  | child_process    |   | fs (node_modules)    |       |
|  | execSync         |   | readFileSync         |       |
|  | (npm audit)      |   |                      |       |
|  +------------------+   +----------------------+       |
|            |                                           |
|            v                                           |
|  +---------------------------------------------------+ |
|  |   Event Bus: code:dependency-alert                | |
|  +---------------------------------------------------+ |
+--------------------------------------------------------+
```

### Key Features

- **npm audit integration**: wrapper around `npm audit --json` with structured parsing
- **Import scanning**: recursive analysis of source files to find unused dependencies
- **License audit**: direct reading of `package.json` files in `node_modules`
- **Automatic alerts**: event publication for critical/high vulnerabilities

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `check-vulnerabilities` | Runs `npm audit --json` and groups vulnerabilities by severity | `projectPath` (string) - Absolute path to the project directory |
| `find-unused` | Analyzes imports in source files to find unused dependencies | `projectPath` (string) - Absolute path to the project directory |
| `license-audit` | Reads the license of each dependency from `node_modules` and flags copyleft ones | `projectPath` (string) - Absolute path to the project directory |

---

## Architecture

The server is stateless and has no internal services. Each tool works directly
with the filesystem and child processes.

```
  projectPath
      |
      +-- package.json  <--- read by all 3 tools
      |
      +-- node_modules/ <--- read by license-audit
      |     +-- pkg-a/
      |     |     +-- package.json ("license" field)
      |     +-- pkg-b/
      |           +-- package.json
      |
      +-- src/           <--- scanned by find-unused
            +-- index.ts
            +-- app.ts
            +-- utils/
```

### Flow of `check-vulnerabilities`

1. Verifies that `package.json` exists at the specified path
2. Runs `npm audit --json` with a 60-second timeout
3. Handles the non-zero exit code (npm audit exits with error if vulnerabilities are found)
4. Parses the JSON output in the npm v7+ format
5. Groups by severity: `critical`, `high`, `moderate`, `low`, `info`
6. For each critical/high vulnerability, publishes a `code:dependency-alert` event

### Flow of `find-unused`

1. Reads `dependencies` and `devDependencies` from `package.json`
2. Recursively collects all `.ts`, `.js`, `.tsx`, `.jsx` files
3. Skips directories: `node_modules`, `dist`, `build`, `.git`, `coverage`
4. Extracts package names from:
   - ES module imports: `import ... from 'package'`
   - CommonJS: `require('package')`
   - Dynamic imports: `import('package')`
5. Handles scoped packages: `@scope/package`
6. Compares declared dependencies with imported ones
7. Reports separately `unusedDependencies` and `unusedDevDependencies`

### Flow of `license-audit`

1. Reads all dependencies from `package.json`
2. For each dependency, reads the `package.json` in `node_modules/<dep>/`
3. Extracts the `license` field (string, `{type, url}` object, or legacy `licenses` array)
4. Compares against the copyleft license list:
   - GPL (2.0, 3.0, -only, -or-later)
   - AGPL (1.0, 3.0)
   - LGPL (2.0, 2.1, 3.0)
   - MPL-2.0, EUPL, CPAL-1.0, OSL-3.0, CC-BY-SA-4.0
5. Groups dependencies by license type
6. Separately flags dependencies with copyleft licenses

---

## Event Bus Integration

### Published Events

| Event | Emitted by | Payload | Condition |
|-------|-----------|---------|-----------|
| `code:dependency-alert` | `check-vulnerabilities` | `{ package, severity, advisory }` | For each vulnerability with `critical` or `high` severity |

### Subscribed Events

None.

---

## Interactions with Other Servers

```
+---------------------+    code:dependency-alert    +-------------------+
| dependency-manager  | --------------------------> | standup-notes     |
|                     |                             | agile-metrics     |
+---------------------+                             +-------------------+
         ^
         |  (input: projectPath)
         |
+---------------------+
| project-scaffolding |  generates projects with dependencies that
|                     |  dependency-manager can then analyze
+---------------------+
```

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `standup-notes` | -> (via event) | Receives alerts about critical vulnerabilities |
| `agile-metrics` | -> (via event) | Can track the vulnerability trend |
| `project-scaffolding` | complementary | Generated projects can be analyzed |
| `code-review` | complementary | Both evaluate different aspects of code quality |

---

## Usage Examples

### Vulnerability check

**Request:**
```json
{
  "tool": "check-vulnerabilities",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Response (simplified):**
```json
{
  "project": "my-project",
  "totalVulnerabilities": 5,
  "severityCounts": {
    "high": 2,
    "moderate": 2,
    "low": 1
  },
  "vulnerabilities": {
    "high": [
      {
        "name": "lodash",
        "severity": "high",
        "title": "Prototype Pollution",
        "url": "https://github.com/advisories/GHSA-xxxx",
        "range": "<4.17.21",
        "fixAvailable": { "name": "lodash", "version": "4.17.21" }
      }
    ]
  },
  "metadata": {
    "totalDependencies": 142,
    "devDependencies": 38,
    "prodDependencies": 104
  }
}
```

### Finding unused dependencies

**Request:**
```json
{
  "tool": "find-unused",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Response:**
```json
{
  "project": "my-project",
  "sourceFilesScanned": 47,
  "summary": {
    "totalDependencies": 12,
    "totalDevDependencies": 8,
    "unusedDependencies": 2,
    "unusedDevDependencies": 1
  },
  "unusedDependencies": ["moment", "lodash"],
  "unusedDevDependencies": ["@types/lodash"],
  "note": "Dependencies may be used in config files, scripts, or other non-source files."
}
```

### License audit

**Request:**
```json
{
  "tool": "license-audit",
  "arguments": {
    "projectPath": "/home/user/my-project"
  }
}
```

**Response (simplified):**
```json
{
  "project": "my-project",
  "summary": {
    "totalDependenciesChecked": 20,
    "uniqueLicenses": 4,
    "copyleftCount": 1,
    "notFoundInNodeModules": 0
  },
  "copyleftWarnings": [
    { "name": "some-gpl-lib", "version": "2.1.0", "license": "GPL-3.0" }
  ],
  "byLicense": {
    "MIT": [{ "name": "express", "version": "4.21.0" }],
    "ISC": [{ "name": "glob", "version": "10.3.0" }],
    "GPL-3.0": [{ "name": "some-gpl-lib", "version": "2.1.0" }]
  }
}
```

---

## Future Developments

- **pnpm/yarn support**: analysis of specific lockfiles beyond npm
- **Automatic updates**: suggesting updated versions for outdated dependencies
- **Configurable license policy**: `.license-policy.json` file to define accepted/rejected licenses
- **Audit result caching**: avoiding repeated npm audit calls for the same project
- **Deep scanning**: analysis of transitive imports (dependencies of dependencies)
- **Integration with `cicd-monitor`**: automatic audit trigger on every build
- **PDF/HTML reports**: generation of formatted reports for non-technical stakeholders
- **Monorepo support**: coordinated analysis of pnpm/npm workspaces
