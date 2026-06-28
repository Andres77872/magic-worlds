// Stub for @/infrastructure/api/mediaUrl — the real module imports ./baseUrl
// (import.meta.env, fatal in the IIFE). Previews treat every url as a plain,
// non-protected url, matching exactly what src/ui imports from this path.
export function resolveMediaUrl(url?: string | null): string | undefined {
  return url ?? undefined
}
export function isProtectedMediaUrl(_url?: string | null): boolean {
  return false
}
