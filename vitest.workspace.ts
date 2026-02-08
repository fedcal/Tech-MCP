import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['packages/*/vitest.config.ts', 'servers/*/vitest.config.ts']);
