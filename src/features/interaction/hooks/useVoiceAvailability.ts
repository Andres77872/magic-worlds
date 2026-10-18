import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isVoicesFeatureEnabled, isCallsFeatureEnabled } from '@/shared/featureFlags'
import { useEffect, useState } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { VoiceCapabilities, VoiceCapabilityStatus, VoiceProvider } from '@/shared'
import { FAIL_OPEN_VOICE_STATUS, surfaceCapabilitiesFor } from '@/shared/voice'

/** The consent copy version the server requires (D25): only `voice-v2` after the voice purge (I-68). */
export type VoiceConsentVersion = 'voice-v2' | 'voice-v3'

/** The server switches plus the consent copy version a call records (R1-FE-05). */
export interface VoiceAvailability extends VoiceCapabilityStatus {
    /** Always `voice-v2`: the version the BFF records and requires. */
    consentVersion: VoiceConsentVersion
}

/** Nothing paused or off; consent `voice-v2`. */
export const FAIL_OPEN_VOICE_AVAILABILITY: VoiceAvailability = Object.freeze({
    ...FAIL_OPEN_VOICE_STATUS,
    consentVersion: 'voice-v2',
})

function availabilityOf(capabilities: VoiceCapabilities, provider: VoiceProvider): VoiceAvailability {
    return {
        ...(capabilities.status ?? FAIL_OPEN_VOICE_STATUS),
        ...(provider === 'fish_audio' ? {
            calls_available: capabilities.status?.calls_available === true
                && surfaceCapabilitiesFor(capabilities, 'call', 'standard', provider)?.healthy === true,
        } : {}),
        consentVersion: capabilities.consent_version_required === 'voice-v3' ? 'voice-v3' : 'voice-v2',
    }
}

/**
 * The server's voice switches for this account (09 §1.5 `capabilities.status`;
 * I-12 runtime switches, the D37 spend circuit, an active voice restriction):
 * whether narration and calls are available right now (09 §7: narration buttons
 * and call start are disabled with copy when they are not), plus the required
 * consent version.
 *
 * Reads the shared 60 s capabilities cache while `active`, again when
 * `refreshKey` changes. Fail open: a server without `status`, an api without
 * the read, or a failed read reads as available, and a failed refresh keeps the
 * last reading. The server still refuses what it must.
 */
export function useVoiceAvailability(
    api: Partial<Pick<ApiService, 'getVoiceCapabilities'>> | null | undefined,
    requestedActive: boolean,
    refreshKey: unknown = 0,
    provider: VoiceProvider = 'elevenlabs',
): VoiceAvailability {
    useFeatureFlags()
    const active = requestedActive && isVoicesFeatureEnabled()
    const [snapshot, setSnapshot] = useState<VoiceCapabilities | null>(null)
    const availability = snapshot ? availabilityOf(snapshot, provider)
        : { ...FAIL_OPEN_VOICE_AVAILABILITY, ...(provider === 'fish_audio' ? { calls_available: false } : {}) }

    useEffect(() => {
        if (!active || typeof api?.getVoiceCapabilities !== 'function') return
        let cancelled = false
        void Promise.resolve()
            .then(() => api.getVoiceCapabilities!())
            .then((capabilities) => {
                if (!cancelled && capabilities) setSnapshot(capabilities)
            })
            .catch(() => {
                // Fail open: keep the last reading.
            })
        return () => {
            cancelled = true
        }
    }, [active, api, refreshKey])

    const effective = active ? availability
        : { ...FAIL_OPEN_VOICE_AVAILABILITY, ...(provider === 'fish_audio' ? { calls_available: false } : {}) }
    return !isVoicesFeatureEnabled()
        ? { ...FAIL_OPEN_VOICE_AVAILABILITY, narration_available: false, calls_available: false }
        : { ...effective, calls_available: isCallsFeatureEnabled() && effective.calls_available }
}
