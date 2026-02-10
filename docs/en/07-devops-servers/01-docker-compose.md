# Docker Compose Server

## Overview

The **docker-compose** server provides tools for managing Docker Compose stacks:
parsing, analysis, monitoring, and configuration generation. It solves the problem of
increasing complexity in `docker-compose.yml` files and `Dockerfile`s, where configuration
errors, bad practices, and lack of standardization can cause problems in production.

```
+------------------------------------------------------------+
|               docker-compose server                        |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  parse-compose     analyze-dockerfile                 | |
|  |  list-services     generate-compose                   | |
|  +-------------------------------------------------------+ |
|        |                                    |              |
|        v                                    v              |
|  +------------+                    +------------------+    |
|  | fs         |                    | child_process    |    |
|  | readFile   |                    | execSync         |    |
|  | (YAML/     |                    | (docker compose  |    |
|  |  Docker)   |                    |  ps --format     |    |
|  +------------+                    |  json)           |    |
|                                    +------------------+    |
+------------------------------------------------------------+
```

### Key Features

- **Simplified YAML parser**: line-based analysis without external dependencies
- **Best practice validation**: rules for Dockerfile and docker-compose.yml
- **Runtime monitoring**: list of running services via `docker compose ps`
- **YAML generation**: docker-compose.yml creation from structured definitions
- **No events**: stateless server without Event Bus integration

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `parse-compose` | Parses and validates a docker-compose.yml file, extracting services, networks, volumes, and issues | `filePath` (string) - Path to the docker-compose.yml file |
| `analyze-dockerfile` | Analyzes a Dockerfile for best practices, security, and optimization | `filePath` (string) - Path to the Dockerfile |
| `list-services` | Lists running Docker services, optionally filtered by Compose project | `composePath?` (string) - Optional path to docker-compose.yml |
| `generate-compose` | Generates a docker-compose.yml file from an array of service definitions | `services` (array) - Array of service objects with name, image, ports, environment, volumes |

---

## Architecture

### parse-compose: Line-based YAML Parser

The parser does not depend on external YAML libraries. It analyzes the file line by line:

```
  docker-compose.yml
        |
        v
  +------------------+
  | Line-by-line     |
  | parser           |
  +------------------+
        |
        +-- Top-level sections: services, networks, volumes
        |
        +-- For each service:
        |     +-- Properties: image, build, ports, environment, volumes
        |     +-- Validation:
        |           +-- image without specific tag?
        |           +-- privileged: true?
        |           +-- network_mode: host?
        |           +-- missing image AND build?
        |
        +-- Global validation:
              +-- deprecated "version"
              +-- No services found
```

### analyze-dockerfile: Analysis Rules

The tool checks the following best practices:

| Rule | Severity | Description |
|------|----------|-------------|
| `no-latest-tag` | warning | Base image with `:latest` tag |
| `no-tag` | warning | Base image without explicit tag |
| `large-base-image` | info | Use of full distributions (ubuntu, debian, centos, etc.) |
| `consecutive-run` | warning | Consecutive RUN instructions (increase layers) |
| `apt-no-recommends` | info | `apt-get install` without `--no-install-recommends` |
| `apt-update-alone` | warning | `apt-get update` without `apt-get install` in the same RUN |
| `pipe-to-shell` | warning | Download with curl/wget piped to shell |
| `use-copy-over-add` | info | ADD used where COPY would suffice |
| `missing-healthcheck` | info | No HEALTHCHECK instruction |
| `running-as-root` | warning | No USER instruction (container running as root) |

### list-services: Runtime Monitoring

```
  composePath (optional)
        |
        v
  +------------------+         +------------------+
  | docker compose   |  fail   | docker-compose   |
  | ps --format json | ------> | ps --format json |
  +------------------+         +------------------+
        |                             |
        +----------+------------------+
                   |
                   v
            Parse JSON lines
                   |
                   v
            ServiceInfo[]
            { name, status, image, ports }
```

### generate-compose: YAML Generator

```
  ServiceDefinition[]              docker-compose.yml
  +------------------+             +--------------------+
  | name: "web"      |             | services:          |
  | image: "nginx"   |  -------->  |   web:             |
  | ports: ["80:80"] |             |     image: nginx   |
  | environment: {}  |             |     ports:         |
  | volumes: [...]   |             |       - "80:80"    |
  +------------------+             |     restart: ...   |
                                   |                    |
                                   | volumes:           |
                                   |   data_vol:        |
                                   +--------------------+
```

The generator:
- Automatically adds `restart: unless-stopped` to every service
- Detects named volumes (not bind mounts) and declares them in the `volumes:` section
- Handles correct YAML indentation at 2 spaces

---

## Event Bus Integration

This server **neither publishes nor subscribes to events**. All operations are
on-demand and have no side effects on the Event Bus.

---

## Interactions with Other Servers

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `log-analyzer` | complementary | Analysis of Docker container logs |
| `cicd-monitor` | complementary | Monitoring pipelines that include Docker builds |
| `environment-manager` | complementary | Management of environment variables used in Docker services |
| `project-scaffolding` | complementary | Templates can include Dockerfile and docker-compose.yml |

---

## Usage Examples

### Parsing docker-compose.yml

**Request:**
```json
{
  "tool": "parse-compose",
  "arguments": {
    "filePath": "/home/user/project/docker-compose.yml"
  }
}
```

**Response (simplified):**
```json
{
  "filePath": "/home/user/project/docker-compose.yml",
  "services": ["web", "db", "redis"],
  "serviceCount": 3,
  "networks": ["backend"],
  "volumes": ["db_data"],
  "validationIssues": [
    "Service \"web\" uses image \"nginx\" without a specific tag."
  ],
  "hasIssues": true
}
```

### Dockerfile Analysis

**Request:**
```json
{
  "tool": "analyze-dockerfile",
  "arguments": {
    "filePath": "/home/user/project/Dockerfile"
  }
}
```

**Response:**
```json
{
  "filePath": "/home/user/project/Dockerfile",
  "baseImage": "node:latest",
  "stages": 1,
  "totalInstructions": 12,
  "issues": [
    {
      "line": 1, "severity": "warning", "rule": "no-latest-tag",
      "message": "Base image \"node:latest\" uses the :latest tag.",
      "suggestion": "Pin to a specific version tag (e.g., node:20-alpine)."
    },
    {
      "line": 0, "severity": "warning", "rule": "running-as-root",
      "message": "No USER instruction found.",
      "suggestion": "Add a USER instruction to run as non-root."
    }
  ],
  "summary": { "errors": 0, "warnings": 2, "info": 1 }
}
```

### Generating docker-compose.yml

**Request:**
```json
{
  "tool": "generate-compose",
  "arguments": {
    "services": [
      {
        "name": "api",
        "image": "node:20-alpine",
        "ports": ["3000:3000"],
        "environment": { "NODE_ENV": "production" },
        "volumes": ["./src:/app/src"]
      },
      {
        "name": "postgres",
        "image": "postgres:16-alpine",
        "ports": ["5432:5432"],
        "environment": { "POSTGRES_PASSWORD": "secret" },
        "volumes": ["pg_data:/var/lib/postgresql/data"]
      }
    ]
  }
}
```

**Response:**
```yaml
services:
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: "production"
    volumes:
      - ./src:/app/src
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: "secret"
    volumes:
      - pg_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pg_data:
```

---

## Future Developments

- **Docker Swarm support**: parsing and generation of Swarm configurations
- **Network validation**: verifying that services reference existing networks
- **Multi-stage Dockerfile analysis**: advanced analysis of multi-stage builds
- **Docker image size estimation**: estimating the resulting image size
- **Compose templates**: predefined templates for common stacks (LAMP, MEAN, etc.)
- **Event Bus integration**: events for container start/stop/crash
- **Compose diff**: comparison between two versions of docker-compose.yml
