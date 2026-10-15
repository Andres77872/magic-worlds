import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { useEffect, useState } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { VoiceCapabilities } from '@/shared/types/voiceCatalog.types'

/**
 * The caller's voice capabilities as last read through the shared 60 s cache
 * (`getVoiceCapabilities()`), while `active`; read again when `refreshKey`
 * changes. Null until the first read, when inactive, for an api without the
 * read, or after a failed first read (a failed refresh keeps the last reading).
 *
 * Consumers derive voice UI from it (for example the companion-safety
 * `safeguards`), so null must always mean "show nothing new".
 */
export function useVoiceCapabilitiesSnapshot(
    api: Partial<Pick<ApiService, 'getVoiceCapabilities'>> | null | undefined,
    requestedActive: boolean,
    refreshKey: unknown = 0,
): VoiceCapabilities | null {
    const active = requestedActive && isVoicesFeatureEnabled()
    const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null)

    useEffect(() => {
        if (!active || typeof api?.getVoiceCapabilities !== 'function') return
        let cancelled = false
        void Promise.resolve()
            .then(() => api.getVoiceCapabilities!())
            .then((next) => {
                if (!cancelled && next) setCapabilities(next)
            })
            .catch(() => {
                // Keep the last reading; null until one succeeds.
            })
        return () => {
            cancelled = true
        }
    }, [active, api, refreshKey])

    return active ? capabilities : null
}
