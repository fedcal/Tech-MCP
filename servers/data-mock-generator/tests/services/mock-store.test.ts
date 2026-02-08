import { describe, it, expect, beforeEach } from 'vitest';
import { MockStore } from '../../src/services/mock-store.js';

describe('MockStore', () => {
  let store: MockStore;

  beforeEach(() => {
    store = new MockStore({ inMemory: true });
  });

  // -- Generated Datasets ----------------------------------------------------

  describe('saveDataset', () => {
    it('should save and return a generated dataset with an id', () => {
      const dataset = store.saveDataset({
        name: 'users',
        schema: [{ name: 'id', type: 'integer' }],
        format: 'json',
        rowCount: 100,
        sampleData: [{ id: 1 }, { id: 2 }],
      });

      expect(dataset.id).toBe(1);
      expect(dataset.name).toBe('users');
      expect(dataset.format).toBe('json');
      expect(dataset.rowCount).toBe(100);
      expect(dataset.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the schema JSON array', () => {
      const schema = [
        { name: 'id', type: 'integer' },
        { name: 'email', type: 'string', faker: 'internet.email' },
      ];
      const dataset = store.saveDataset({
        name: 'users',
        schema,
        format: 'json',
        rowCount: 10,
        sampleData: [],
      });

      expect(dataset.schema).toEqual(schema);
      expect(Array.isArray(dataset.schema)).toBe(true);
    });

    it('should serialize and deserialize the sampleData JSON array', () => {
      const sampleData = [
        { id: 1, email: 'a@example.com' },
        { id: 2, email: 'b@example.com' },
      ];
      const dataset = store.saveDataset({
        name: 'users',
        schema: [],
        format: 'csv',
        rowCount: 2,
        sampleData,
      });

      expect(dataset.sampleData).toEqual(sampleData);
      expect(Array.isArray(dataset.sampleData)).toBe(true);
    });
  });

  describe('listDatasets', () => {
    it('should return an empty array when no datasets exist', () => {
      expect(store.listDatasets()).toEqual([]);
    });

    it('should list all datasets', () => {
      store.saveDataset({ name: 'a', schema: [], format: 'json', rowCount: 1, sampleData: [] });
      store.saveDataset({ name: 'b', schema: [], format: 'csv', rowCount: 2, sampleData: [] });

      expect(store.listDatasets()).toHaveLength(2);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveDataset({ name: `ds-${i}`, schema: [], format: 'json', rowCount: i, sampleData: [] });
      }

      expect(store.listDatasets(3)).toHaveLength(3);
    });
  });

  // -- Saved Schemas ---------------------------------------------------------

  describe('saveSchema', () => {
    it('should save and return a schema with an id', () => {
      const schema = store.saveSchema({
        name: 'user-schema',
        description: 'Schema for user records',
        fields: [{ name: 'id', type: 'integer' }],
      });

      expect(schema.id).toBe(1);
      expect(schema.name).toBe('user-schema');
      expect(schema.description).toBe('Schema for user records');
      expect(schema.createdAt).toBeDefined();
    });

    it('should serialize and deserialize the fields JSON array', () => {
      const fields = [
        { name: 'id', type: 'integer' },
        { name: 'name', type: 'string', maxLength: 100 },
      ];
      const schema = store.saveSchema({
        name: 'user-schema',
        description: 'User schema',
        fields,
      });

      expect(schema.fields).toEqual(fields);
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should upsert when saving a schema with the same name', () => {
      store.saveSchema({ name: 'user-schema', description: 'v1', fields: [] });
      const updated = store.saveSchema({ name: 'user-schema', description: 'v2', fields: [{ name: 'email' }] });

      expect(updated.description).toBe('v2');
      expect(store.listSchemas()).toHaveLength(1);
    });
  });

  describe('getSchema', () => {
    it('should return undefined for a non-existent schema', () => {
      expect(store.getSchema('nonexistent')).toBeUndefined();
    });

    it('should retrieve a saved schema by name', () => {
      store.saveSchema({ name: 'user-schema', description: 'test', fields: [] });

      const found = store.getSchema('user-schema');
      expect(found).toBeDefined();
      expect(found!.name).toBe('user-schema');
    });
  });

  describe('listSchemas', () => {
    it('should return an empty array when no schemas exist', () => {
      expect(store.listSchemas()).toEqual([]);
    });

    it('should list all saved schemas', () => {
      store.saveSchema({ name: 'schema-a', description: '', fields: [] });
      store.saveSchema({ name: 'schema-b', description: '', fields: [] });

      expect(store.listSchemas()).toHaveLength(2);
    });
  });
});
