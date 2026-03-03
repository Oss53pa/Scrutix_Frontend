import { describe, it, expect } from 'vitest';
import { JsonValidator } from '../../ai/proph3t/JsonValidator';

describe('JsonValidator', () => {
  describe('extractJson', () => {
    it('should extract JSON from markdown code fences', () => {
      const text = 'Here is the result:\n```json\n[{"id": 1}]\n```\nDone.';
      expect(JsonValidator.extractJson(text)).toBe('[{"id": 1}]');
    });

    it('should extract JSON from fences without json label', () => {
      const text = '```\n{"key": "value"}\n```';
      expect(JsonValidator.extractJson(text)).toBe('{"key": "value"}');
    });

    it('should extract JSON array from mixed text', () => {
      const text = 'Voici les anomalies:\n[{"id": 1}, {"id": 2}]\nFin.';
      expect(JsonValidator.extractJson(text)).toBe('[{"id": 1}, {"id": 2}]');
    });

    it('should extract JSON object from mixed text', () => {
      const text = 'Le rapport:\n{"title": "Rapport"}\nTermine.';
      expect(JsonValidator.extractJson(text)).toBe('{"title": "Rapport"}');
    });

    it('should prefer array over object when array comes first', () => {
      const text = '[1, 2] and {"a": 1}';
      expect(JsonValidator.extractJson(text)).toBe('[1, 2]');
    });

    it('should return trimmed text when no JSON found', () => {
      const text = '  No JSON here  ';
      expect(JsonValidator.extractJson(text)).toBe('No JSON here');
    });

    it('should handle empty string', () => {
      expect(JsonValidator.extractJson('')).toBe('');
    });
  });

  describe('safeParse', () => {
    it('should parse valid JSON directly', () => {
      const result = JsonValidator.safeParse<number[]>('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse JSON wrapped in markdown', () => {
      const text = '```json\n{"name": "test"}\n```';
      const result = JsonValidator.safeParse<{ name: string }>(text);
      expect(result).toEqual({ name: 'test' });
    });

    it('should handle trailing commas', () => {
      const text = '{"a": 1, "b": 2,}';
      const result = JsonValidator.safeParse<{ a: number; b: number }>(text);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should return null for completely invalid input', () => {
      const result = JsonValidator.safeParse('not json at all');
      expect(result).toBeNull();
    });

    it('should handle nested objects', () => {
      const text = '{"data": {"items": [1, 2]}}';
      const result = JsonValidator.safeParse<{ data: { items: number[] } }>(text);
      expect(result).toEqual({ data: { items: [1, 2] } });
    });
  });

  describe('validateShape', () => {
    it('should return true when all required keys exist', () => {
      const data = { name: 'test', age: 25, active: true };
      expect(JsonValidator.validateShape(data, ['name', 'age'])).toBe(true);
    });

    it('should return false when required key is missing', () => {
      const data = { name: 'test' };
      expect(JsonValidator.validateShape(data, ['name', 'age'])).toBe(false);
    });

    it('should return false for null', () => {
      expect(JsonValidator.validateShape(null, ['name'])).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(JsonValidator.validateShape('string', ['length'])).toBe(false);
    });

    it('should return true for empty required keys', () => {
      expect(JsonValidator.validateShape({}, [])).toBe(true);
    });
  });

  describe('parseAndValidate', () => {
    it('should parse and validate a valid object', () => {
      const text = '{"transactionId": "1", "category": "Frais"}';
      const result = JsonValidator.parseAndValidate<{ transactionId: string; category: string }>(
        text,
        ['transactionId', 'category']
      );
      expect(result).toEqual({ transactionId: '1', category: 'Frais' });
    });

    it('should return null for missing required keys', () => {
      const text = '{"transactionId": "1"}';
      const result = JsonValidator.parseAndValidate<{ transactionId: string; category: string }>(
        text,
        ['transactionId', 'category']
      );
      expect(result).toBeNull();
    });

    it('should validate array items', () => {
      const text = '[{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]';
      const result = JsonValidator.parseAndValidate<{ id: number; name: string }>(
        text,
        ['id', 'name']
      );
      expect(result).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
    });

    it('should return null when array items miss required keys', () => {
      const text = '[{"id": 1}, {"id": 2}]';
      const result = JsonValidator.parseAndValidate<{ id: number; name: string }>(
        text,
        ['id', 'name']
      );
      expect(result).toBeNull();
    });
  });
});
