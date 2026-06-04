export function safeStringify(obj: unknown, indent?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
    return value;
  }, indent);
}