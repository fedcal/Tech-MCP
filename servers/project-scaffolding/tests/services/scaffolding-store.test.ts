import { describe, it, expect, beforeEach } from 'vitest';
import { ScaffoldingStore } from '../../src/services/scaffolding-store.js';

describe('ScaffoldingStore', () => {
  let store: ScaffoldingStore;

  beforeEach(() => {
    store = new ScaffoldingStore({ inMemory: true });
  });

  // -- Scaffolded Projects ---------------------------------------------------

  describe('logProject', () => {
    it('should save and return a scaffolded project with an id', () => {
      const project = store.logProject({
        projectName: 'my-app',
        templateName: 'react-ts',
        outputPath: '/home/user/projects/my-app',
        options: { typescript: true, eslint: true },
        filesGenerated: 15,
      });

      expect(project.id).toBe(1);
      expect(project.projectName).toBe('my-app');
      expect(project.templateName).toBe('react-ts');
      expect(project.outputPath).toBe('/home/user/projects/my-app');
      expect(project.filesGenerated).toBe(15);
      expect(project.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the options JSON field', () => {
      const options = { typescript: true, eslint: true, prettier: true, framework: 'react' };
      const project = store.logProject({
        projectName: 'my-app',
        templateName: 'react-ts',
        outputPath: '/out',
        options,
        filesGenerated: 10,
      });

      expect(project.options).toEqual(options);
      expect(typeof project.options).toBe('object');
    });
  });

  describe('listProjects', () => {
    it('should return an empty array when no projects exist', () => {
      expect(store.listProjects()).toEqual([]);
    });

    it('should list all scaffolded projects', () => {
      store.logProject({ projectName: 'a', templateName: 't1', outputPath: '/a', options: {}, filesGenerated: 5 });
      store.logProject({ projectName: 'b', templateName: 't2', outputPath: '/b', options: {}, filesGenerated: 8 });

      expect(store.listProjects()).toHaveLength(2);
    });
  });

  // -- Custom Templates ------------------------------------------------------

  describe('saveTemplate', () => {
    it('should save and return a custom template with an id', () => {
      const template = store.saveTemplate({
        name: 'express-api',
        description: 'Express.js REST API template',
        files: { 'index.ts': 'import express from "express"' },
      });

      expect(template.id).toBe(1);
      expect(template.name).toBe('express-api');
      expect(template.description).toBe('Express.js REST API template');
      expect(template.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the files JSON field', () => {
      const files = {
        'index.ts': 'import express from "express"',
        'package.json': '{ "name": "api" }',
        'tsconfig.json': '{ "strict": true }',
      };
      const template = store.saveTemplate({
        name: 'express-api',
        description: 'API template',
        files,
      });

      expect(template.files).toEqual(files);
      expect(typeof template.files).toBe('object');
    });

    it('should upsert when saving a template with the same name', () => {
      store.saveTemplate({ name: 'express-api', description: 'v1', files: {} });
      const updated = store.saveTemplate({ name: 'express-api', description: 'v2', files: { 'app.ts': 'code' } });

      expect(updated.description).toBe('v2');
      expect(store.listTemplates()).toHaveLength(1);
    });
  });

  describe('getTemplate', () => {
    it('should return undefined for a non-existent template', () => {
      expect(store.getTemplate('nonexistent')).toBeUndefined();
    });

    it('should retrieve a saved template by name', () => {
      store.saveTemplate({ name: 'express-api', description: 'test', files: {} });

      const found = store.getTemplate('express-api');
      expect(found).toBeDefined();
      expect(found!.name).toBe('express-api');
    });
  });

  describe('listTemplates', () => {
    it('should return an empty array when no templates exist', () => {
      expect(store.listTemplates()).toEqual([]);
    });

    it('should list all saved templates', () => {
      store.saveTemplate({ name: 'tpl-a', description: '', files: {} });
      store.saveTemplate({ name: 'tpl-b', description: '', files: {} });

      expect(store.listTemplates()).toHaveLength(2);
    });
  });
});
