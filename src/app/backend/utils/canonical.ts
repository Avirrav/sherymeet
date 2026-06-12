/**
 * Encodes characters according to RFC 3986 specifications.
 * RFC 3986 unreserved characters: A-Z, a-z, 0-9, '-', '.', '_', '~'
 */
export function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Normalizes query string parameters by sorting keys and values alphabetically
 * and encoding keys and values according to RFC 3986.
 */
export function canonicalizeQueryString(queryParams: URLSearchParams | string): string {
  const params = typeof queryParams === 'string' ? new URLSearchParams(queryParams) : queryParams;
  const sortedKeys = Array.from(new Set(params.keys())).sort();
  const parts: string[] = [];

  for (const key of sortedKeys) {
    const values = params.getAll(key).sort();
    for (const val of values) {
      parts.push(`${rfc3986Encode(key)}=${rfc3986Encode(val)}`);
    }
  }

  return parts.join('&');
}

/**
 * Deterministically serializes JSON objects by recursively sorting keys.
 */
export function canonicalizeJson(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  
  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }

  if (typeof val !== 'object') {
    // Primitive types (string, number, boolean)
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  // Object case: sort keys alphabetically and map values recursively
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalizeJson(obj[key]);
  });

  return '{' + parts.join(',') + '}';
}
