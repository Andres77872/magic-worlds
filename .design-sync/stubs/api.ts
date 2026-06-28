// Inert API surface for the design-sync bundle (see .design-sync/NOTES.md).
// The real @/infrastructure/api builds `apiService` at MODULE SCOPE and reads
// import.meta.env via ./baseUrl — fatal in an esbuild IIFE — and opens network +
// websocket side effects. Design previews never touch the backend, so this
// provides a no-op surface covering exactly what src/ui imports from the barrel
// (apiService, resolveMediaUrl, the ApiDependencyService type).

// Type-only export (erased at build); shape is irrelevant to static previews.
export type ApiDependencyService = unknown

// Real resolveMediaUrl maps a stored media path to an absolute URL and returns
// string | undefined. Previews use direct/mock urls, so echo the input.
export function resolveMediaUrl(url?: string | null): string | undefined {
  return url ?? undefined
}

// Permissive no-op proxy: any apiService.<method> access is safe at module load
// (returns a function) and any call returns a never-settling promise, so static
// preview renders neither throw nor await a real backend response.
export const apiService: any = new Proxy(
  {},
  { get: () => (..._args: unknown[]) => new Promise<never>(() => {}) },
)
