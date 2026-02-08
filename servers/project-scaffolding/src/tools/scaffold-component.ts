/**
 * Tool: scaffold-component
 * Generates a single component, service, controller, or model file.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScaffoldingStore } from '../services/scaffolding-store.js';

type ComponentType = 'component' | 'service' | 'controller' | 'model';
type Language = 'typescript' | 'javascript';

function generateComponent(
  type: ComponentType,
  name: string,
  language: Language,
): { filename: string; content: string } {
  const ext = language === 'typescript' ? 'ts' : 'js';
  const typeAnnotation = language === 'typescript';

  switch (type) {
    case 'component': {
      const tsxExt = language === 'typescript' ? 'tsx' : 'jsx';
      return {
        filename: `${name}.${tsxExt}`,
        content: typeAnnotation
          ? `export interface ${name}Props {
  children?: React.ReactNode;
}

export function ${name}({ children }: ${name}Props) {
  return (
    <div className="${name.toLowerCase()}">
      {children}
    </div>
  );
}
`
          : `export function ${name}({ children }) {
  return (
    <div className="${name.toLowerCase()}">
      {children}
    </div>
  );
}
`,
      };
    }

    case 'service': {
      return {
        filename: `${name}.service.${ext}`,
        content: typeAnnotation
          ? `export class ${name}Service {
  async findAll(): Promise<unknown[]> {
    throw new Error('Not implemented');
  }

  async findById(id: string): Promise<unknown | null> {
    throw new Error(\`Not implemented: findById(\${id})\`);
  }

  async create(data: unknown): Promise<unknown> {
    throw new Error(\`Not implemented: create(\${JSON.stringify(data)})\`);
  }

  async update(id: string, data: unknown): Promise<unknown> {
    throw new Error(\`Not implemented: update(\${id}, \${JSON.stringify(data)})\`);
  }

  async delete(id: string): Promise<void> {
    throw new Error(\`Not implemented: delete(\${id})\`);
  }
}

export const ${name.charAt(0).toLowerCase() + name.slice(1)}Service = new ${name}Service();
`
          : `export class ${name}Service {
  async findAll() {
    throw new Error('Not implemented');
  }

  async findById(id) {
    throw new Error(\`Not implemented: findById(\${id})\`);
  }

  async create(data) {
    throw new Error(\`Not implemented: create(\${JSON.stringify(data)})\`);
  }

  async update(id, data) {
    throw new Error(\`Not implemented: update(\${id}, \${JSON.stringify(data)})\`);
  }

  async delete(id) {
    throw new Error(\`Not implemented: delete(\${id})\`);
  }
}

export const ${name.charAt(0).toLowerCase() + name.slice(1)}Service = new ${name}Service();
`,
      };
    }

    case 'controller': {
      return {
        filename: `${name}.controller.${ext}`,
        content: typeAnnotation
          ? `import type { Request, Response } from 'express';

export class ${name}Controller {
  async getAll(_req: Request, res: Response): Promise<void> {
    res.json({ message: '${name} getAll - not implemented' });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    res.json({ message: \`${name} getById(\${id}) - not implemented\` });
  }

  async create(req: Request, res: Response): Promise<void> {
    const data = req.body;
    res.status(201).json({ message: '${name} created', data });
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data = req.body;
    res.json({ message: \`${name} updated(\${id})\`, data });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    res.json({ message: \`${name} deleted(\${id})\` });
  }
}

export const ${name.charAt(0).toLowerCase() + name.slice(1)}Controller = new ${name}Controller();
`
          : `export class ${name}Controller {
  async getAll(_req, res) {
    res.json({ message: '${name} getAll - not implemented' });
  }

  async getById(req, res) {
    const { id } = req.params;
    res.json({ message: \`${name} getById(\${id}) - not implemented\` });
  }

  async create(req, res) {
    const data = req.body;
    res.status(201).json({ message: '${name} created', data });
  }

  async update(req, res) {
    const { id } = req.params;
    const data = req.body;
    res.json({ message: \`${name} updated(\${id})\`, data });
  }

  async delete(req, res) {
    const { id } = req.params;
    res.json({ message: \`${name} deleted(\${id})\` });
  }
}

export const ${name.charAt(0).toLowerCase() + name.slice(1)}Controller = new ${name}Controller();
`,
      };
    }

    case 'model': {
      return {
        filename: `${name}.model.${ext}`,
        content: typeAnnotation
          ? `export interface ${name} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${name}Input {
  // Define creation fields here
}

export interface Update${name}Input {
  // Define update fields here
}

export function create${name}(input: Create${name}Input): ${name} {
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ${name};
}

export function update${name}(existing: ${name}, input: Update${name}Input): ${name} {
  return {
    ...existing,
    ...input,
    updatedAt: new Date(),
  };
}
`
          : `export function create${name}(input) {
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function update${name}(existing, input) {
  return {
    ...existing,
    ...input,
    updatedAt: new Date(),
  };
}
`,
      };
    }
  }
}

export function registerScaffoldComponent(server: McpServer, store: ScaffoldingStore): void {
  server.tool(
    'scaffold-component',
    'Generate a single component, service, controller, or model file',
    {
      type: z
        .enum(['component', 'service', 'controller', 'model'])
        .describe('Type of file to generate'),
      name: z.string().describe('Name for the generated module (PascalCase recommended)'),
      outputDir: z
        .string()
        .describe('Absolute path to the directory where the file will be created'),
      language: z
        .enum(['typescript', 'javascript'])
        .describe('Target language for the generated file'),
    },
    async ({ type, name, outputDir, language }) => {
      try {
        const { filename, content } = generateComponent(type, name, language);
        const filePath = join(outputDir, filename);

        await mkdir(outputDir, { recursive: true });
        await writeFile(filePath, content, 'utf-8');

        // Log the generated component as a project entry
        store.logProject({
          projectName: name,
          templateName: `${type}-${language}`,
          outputPath: filePath,
          options: { type, language },
          filesGenerated: 1,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Generated ${type} file: ${filePath}\n\n${content}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to generate ${type}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
