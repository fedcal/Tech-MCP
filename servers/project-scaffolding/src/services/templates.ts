/**
 * Template definitions for project scaffolding.
 * Each template maps relative file paths to file content strings.
 * Supports placeholder substitution: {{projectName}}, {{author}}, {{description}}, {{license}}.
 */

export interface TemplateDefinition {
  name: string;
  description: string;
  files: Record<string, string>;
}

const nodeTypescriptTemplate: TemplateDefinition = {
  name: 'node-typescript',
  description: 'Node.js project with TypeScript, ESM, and Vitest',
  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "{{license}}",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,
    'src/index.ts': `/**
 * {{projectName}} - {{description}}
 */

export function main(): void {
  console.log('Hello from {{projectName}}!');
}

main();
`,
    '.gitignore': `node_modules/
dist/
*.tsbuildinfo
.env
`,
    'README.md': `# {{projectName}}

{{description}}

## Getting Started

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
npm test
\`\`\`

## License

{{license}}
`,
  },
};

const expressApiTemplate: TemplateDefinition = {
  name: 'express-api',
  description: 'Express REST API with TypeScript, routing, and middleware',
  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "{{license}}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,
    'src/index.ts': `/**
 * {{projectName}} - {{description}}
 */

import { app } from './app.js';

const PORT = process.env['PORT'] || 3000;

app.listen(PORT, () => {
  console.log(\`{{projectName}} listening on port \${PORT}\`);
});
`,
    'src/app.ts': `import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/health', healthRouter);

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to {{projectName}}' });
});
`,
    'src/routes/health.ts': `import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
`,
    'src/middleware/error-handler.ts': `import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
}
`,
    '.gitignore': `node_modules/
dist/
*.tsbuildinfo
.env
`,
    'README.md': `# {{projectName}}

{{description}}

## Getting Started

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## API Endpoints

- \`GET /\` - Welcome message
- \`GET /health\` - Health check

## License

{{license}}
`,
  },
};

const reactAppTemplate: TemplateDefinition = {
  name: 'react-app',
  description: 'React application with TypeScript and Vite',
  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "{{license}}",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vitest": "^3.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
`,
    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    'src/App.tsx': `export function App() {
  return (
    <div>
      <h1>{{projectName}}</h1>
      <p>{{description}}</p>
    </div>
  );
}
`,
    'src/App.css': `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
`,
    '.gitignore': `node_modules/
dist/
*.tsbuildinfo
.env
`,
    'README.md': `# {{projectName}}

{{description}}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
npm run preview
\`\`\`

## License

{{license}}
`,
  },
};

const mcpServerTemplate: TemplateDefinition = {
  name: 'mcp-server',
  description: 'Model Context Protocol server with TypeScript',
  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "{{license}}",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "{{projectName}}": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,
    'src/index.ts': `#!/usr/bin/env node

/**
 * Entry point for the {{projectName}} MCP server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

const server = new McpServer({
  name: '{{projectName}}',
  version: '0.1.0',
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
`,
    'src/tools.ts': `import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerTools(server: McpServer): void {
  server.tool(
    'hello',
    'Say hello',
    {
      name: z.string().describe('Name to greet'),
    },
    async ({ name }) => {
      return {
        content: [{ type: 'text' as const, text: \`Hello, \${name}! Welcome to {{projectName}}.\` }],
      };
    },
  );
}
`,
    '.gitignore': `node_modules/
dist/
*.tsbuildinfo
.env
`,
    'README.md': `# {{projectName}}

{{description}}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

Add to your MCP client configuration:

\`\`\`json
{
  "mcpServers": {
    "{{projectName}}": {
      "command": "node",
      "args": ["path/to/{{projectName}}/dist/index.js"]
    }
  }
}
\`\`\`

## License

{{license}}
`,
  },
};

export const TEMPLATES: Record<string, TemplateDefinition> = {
  'node-typescript': nodeTypescriptTemplate,
  'express-api': expressApiTemplate,
  'react-app': reactAppTemplate,
  'mcp-server': mcpServerTemplate,
};

/**
 * Substitute placeholders in a template string.
 */
export function substitutePlaceholders(
  content: string,
  values: Record<string, string>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
