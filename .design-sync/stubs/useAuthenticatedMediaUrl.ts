// Stub for @/infrastructure/api/useAuthenticatedMediaUrl — the real hook fetches
// protected media as an authed blob (needs apiService + import.meta.env). In a
// preview there is no backend, so resolve to the url directly, never loading.
// Return shape matches the real AuthenticatedMediaUrlState.
interface AuthenticatedMediaUrlState {
  src?: string
  loading: boolean
  error: Error | null
}
export function useAuthenticatedMediaUrl(url?: string | null): AuthenticatedMediaUrlState {
  return { src: url ?? undefined, loading: false, error: null }
}
