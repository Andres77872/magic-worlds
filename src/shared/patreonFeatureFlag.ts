/**
 * Frontend kill-switch for Patreon affordances and the Patreon `apiService`
 * methods. No Patreon UI ships yet; this scaffolds the flag so any future
 * link/connect UI is gated and the API surface is inert while disabled.
 *
 * Default OFF: an unset/absent `VITE_PATREON_ENABLED` resolves to `false`, so
 * Patreon is off unless the env var is explicitly the string `'true'`.
 */
export function isPatreonFeatureEnabled(): boolean {
    return import.meta.env.VITE_PATREON_ENABLED === 'true'
}
