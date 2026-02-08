import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewStore } from '../../src/services/review-store.js';

describe('ReviewStore', () => {
  let store: ReviewStore;

  beforeEach(() => {
    store = new ReviewStore({ inMemory: true });
  });

  // ── saveReview / listReviews ──────────────────────────────────────────

  describe('saveReview', () => {
    it('should save a review and return it with parsed suggestions', () => {
      const review = store.saveReview({
        reviewType: 'security',
        filePath: '/src/auth.ts',
        issuesFound: 3,
        suggestions: ['Use parameterized queries', 'Add input validation'],
        result: 'Found 3 issues in auth module',
      });

      expect(review.id).toBeDefined();
      expect(review.reviewType).toBe('security');
      expect(review.filePath).toBe('/src/auth.ts');
      expect(review.issuesFound).toBe(3);
      expect(review.suggestions).toEqual(['Use parameterized queries', 'Add input validation']);
      expect(review.result).toBe('Found 3 issues in auth module');
    });

    it('should handle null filePath', () => {
      const review = store.saveReview({
        reviewType: 'general',
        issuesFound: 0,
        suggestions: [],
        result: 'No issues found',
      });

      expect(review.filePath).toBeNull();
    });

    it('should handle empty suggestions array', () => {
      const review = store.saveReview({
        reviewType: 'style',
        issuesFound: 0,
        suggestions: [],
        result: 'Clean code',
      });

      expect(review.suggestions).toEqual([]);
    });
  });

  describe('listReviews', () => {
    it('should return all reviews', () => {
      store.saveReview({
        reviewType: 'security',
        issuesFound: 1,
        suggestions: ['Fix A'],
        result: 'Result A',
      });
      store.saveReview({
        reviewType: 'performance',
        issuesFound: 2,
        suggestions: ['Fix B'],
        result: 'Result B',
      });

      const reviews = store.listReviews();
      expect(reviews).toHaveLength(2);
      const types = reviews.map((r) => r.reviewType);
      expect(types).toContain('security');
      expect(types).toContain('performance');
    });

    it('should filter reviews by type', () => {
      store.saveReview({ reviewType: 'security', issuesFound: 1, suggestions: [], result: 'A' });
      store.saveReview({ reviewType: 'performance', issuesFound: 0, suggestions: [], result: 'B' });
      store.saveReview({ reviewType: 'security', issuesFound: 2, suggestions: [], result: 'C' });

      const securityReviews = store.listReviews('security');
      expect(securityReviews).toHaveLength(2);
      securityReviews.forEach((r) => expect(r.reviewType).toBe('security'));
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.saveReview({ reviewType: 'test', issuesFound: i, suggestions: [], result: `R${i}` });
      }

      const limited = store.listReviews(undefined, 3);
      expect(limited).toHaveLength(3);
    });

    it('should return empty array when no reviews exist', () => {
      expect(store.listReviews()).toEqual([]);
    });
  });

  // ── saveComplexity / listComplexityRecords ────────────────────────────

  describe('saveComplexity', () => {
    it('should save a complexity record', () => {
      const record = store.saveComplexity({
        filePath: '/src/utils.ts',
        language: 'typescript',
        totalComplexity: 15,
        rating: 'moderate',
        lineCount: 200,
      });

      expect(record.id).toBeDefined();
      expect(record.filePath).toBe('/src/utils.ts');
      expect(record.language).toBe('typescript');
      expect(record.totalComplexity).toBe(15);
      expect(record.rating).toBe('moderate');
      expect(record.lineCount).toBe(200);
    });

    it('should handle null filePath', () => {
      const record = store.saveComplexity({
        language: 'python',
        totalComplexity: 5,
        rating: 'low',
        lineCount: 50,
      });

      expect(record.filePath).toBeNull();
    });
  });

  describe('listComplexityRecords', () => {
    it('should return all complexity records', () => {
      store.saveComplexity({ filePath: '/a.ts', language: 'ts', totalComplexity: 5, rating: 'low', lineCount: 100 });
      store.saveComplexity({ filePath: '/b.ts', language: 'ts', totalComplexity: 20, rating: 'high', lineCount: 500 });

      const records = store.listComplexityRecords();
      expect(records).toHaveLength(2);
    });

    it('should filter by filePath', () => {
      store.saveComplexity({ filePath: '/a.ts', language: 'ts', totalComplexity: 5, rating: 'low', lineCount: 100 });
      store.saveComplexity({ filePath: '/b.ts', language: 'ts', totalComplexity: 20, rating: 'high', lineCount: 500 });

      const filtered = store.listComplexityRecords('/a.ts');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].filePath).toBe('/a.ts');
    });

    it('should return empty array when no records exist', () => {
      expect(store.listComplexityRecords()).toEqual([]);
    });
  });

  // ── JSON Serialization ────────────────────────────────────────────────

  describe('JSON serialization of suggestions', () => {
    it('should correctly serialize and deserialize suggestions array', () => {
      const review = store.saveReview({
        reviewType: 'security',
        filePath: '/src/index.ts',
        issuesFound: 2,
        suggestions: ['Use HTTPS', 'Sanitize input', 'Add rate limiting'],
        result: 'Multiple issues',
      });

      const reviews = store.listReviews();
      const fetched = reviews.find((r) => r.id === review.id)!;

      expect(Array.isArray(fetched.suggestions)).toBe(true);
      expect(fetched.suggestions).toEqual(['Use HTTPS', 'Sanitize input', 'Add rate limiting']);
    });
  });
});
