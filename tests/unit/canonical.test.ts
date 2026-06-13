import { canonicalizeQueryString, canonicalizeJson, rfc3986Encode } from '../../src/app/backend/utils/canonical';

describe('Canonical Serialization Utilities', () => {
  describe('rfc3986Encode', () => {
    it('should leave unreserved characters unencoded', () => {
      const unreserved = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
      expect(rfc3986Encode(unreserved)).toBe(unreserved);
    });

    it('should percent encode special characters in uppercase hex', () => {
      expect(rfc3986Encode(' ')).toBe('%20');
      expect(rfc3986Encode('!@#')).toBe('%21%40%23');
      expect(rfc3986Encode("hello'world")).toBe('hello%27world');
    });
  });

  describe('canonicalizeQueryString', () => {
    it('should sort query parameters alphabetically', () => {
      const q1 = 'sort=name&page=1&limit=10';
      const q2 = 'limit=10&sort=name&page=1';
      expect(canonicalizeQueryString(q1)).toBe('limit=10&page=1&sort=name');
      expect(canonicalizeQueryString(q2)).toBe('limit=10&page=1&sort=name');
    });

    it('should sort values alphabetically for multi-value keys', () => {
      const q = 'tag=redis&tag=node&tag=aws';
      expect(canonicalizeQueryString(q)).toBe('tag=aws&tag=node&tag=redis');
    });

    it('should apply RFC 3986 encoding to keys and values', () => {
      const q = 'my key=some value!';
      expect(canonicalizeQueryString(q)).toBe('my%20key=some%20value%21');
    });
  });

  describe('canonicalizeJson', () => {
    it('should deterministically stringify primitives', () => {
      expect(canonicalizeJson(null)).toBe('null');
      expect(canonicalizeJson(123)).toBe('123');
      expect(canonicalizeJson('hello')).toBe('"hello"');
      expect(canonicalizeJson(true)).toBe('true');
    });

    it('should sort object keys alphabetically and recursively', () => {
      const obj1 = { z: 1, a: { y: 2, b: 3 } };
      const obj2 = { a: { b: 3, y: 2 }, z: 1 };
      
      const expected = '{"a":{"b":3,"y":2},"z":1}';
      expect(canonicalizeJson(obj1)).toBe(expected);
      expect(canonicalizeJson(obj2)).toBe(expected);
    });

    it('should handle nested arrays correctly', () => {
      const obj = { arr: [ { b: 2, a: 1 }, 3, 'four' ] };
      expect(canonicalizeJson(obj)).toBe('{"arr":[{"a":1,"b":2},3,"four"]}');
    });

    it('should serialize Date objects to ISO string representation', () => {
      const date = new Date('2026-06-09T12:00:00.000Z');
      expect(canonicalizeJson(date)).toBe('"2026-06-09T12:00:00.000Z"');
    });
  });
});
