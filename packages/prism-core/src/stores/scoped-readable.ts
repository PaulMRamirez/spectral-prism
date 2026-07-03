import type { StoreReadable } from './types';

/** Safe path segment: no scheme, no traversal, no absolute or empty parts. */
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/**
 * Validates a store-relative subpath. Subpaths often come from store metadata
 * (the dual-layout binding, the stats sidecar pointer), which is
 * attacker-controllable: a value like "../other", "//evil.example", or
 * "http://evil.example/x" would otherwise resolve against a FetchStore base
 * URL and escape the store root or redirect reads cross-origin (SSRF). Returns
 * the normalized `a/b` form, or null when any segment is unsafe.
 */
export function safeSubpath(path: string): string | null {
  if (path.length === 0) return null;
  const segments = path.split('/');
  // Reject rather than normalize: an empty segment means a leading, trailing,
  // or double slash (so "/x", "//evil.example" are refused, not silently
  // rerooted), and SAFE_SEGMENT rejects "..", ".", and scheme-bearing parts.
  if (segments.some((s) => !SAFE_SEGMENT.test(s))) return null;
  return segments.join('/');
}

/**
 * A readable rooted at a subpath of another readable, so any group-level
 * consumer (the GeoZarr convention reader, zarrita open) can target a child
 * group of a store without knowing about the parent layout. Throws when the
 * subpath is unsafe (see safeSubpath); callers that accept metadata-supplied
 * paths should degrade rather than propagate the throw.
 */
export function scopedReadable(readable: StoreReadable, subpath: string): StoreReadable {
  const safe = safeSubpath(subpath);
  if (safe === null) throw new Error(`refusing unsafe store subpath: ${JSON.stringify(subpath)}`);
  const base = `/${safe}` as const;
  const scoped: StoreReadable = {
    get: (key, ...rest) => readable.get(`${base}${key}`, ...(rest as [])),
  };
  if (readable.getRange) {
    const getRange = readable.getRange.bind(readable);
    scoped.getRange = (key, range, ...rest) => getRange(`${base}${key}`, range, ...(rest as []));
  }
  return scoped;
}
