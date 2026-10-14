import { useCallback, useEffect, useState } from 'react'
import type { ApiService } from '@/infrastructure/api'

/** How long a server refusal (`tts_failed` code `auto_narration_paused`) holds auto-narration off before it is tried again. */
export const AUTO_NARRATION_PAUSE_HOLD_MS = 5 * 60_000

export interface AutoNarrationPause {
    /** The server paused auto-narration (D37 budget circuit or an operator). Manual play still works. */
    paused: boolean
    /** Record a `tts_failed` with `error.code: "auto_narration_paused"` (06 §2.3, proposed). */
    reportPaused: () => void
}

/**
 * Whether auto-narration is paused (D37; 09 §4.5, §7). Two signals:
 * - `capabilities.status.auto_narration_paused` (09 §1.5 client switch, a
 *   proposal not in 08 yet), read only while auto-narrate is on and shared
 *   through the 60 s capabilities cache. A server without the field, or a
 *   failed read, reads as not paused: the server still refuses what it must.
 * - a chat `tts_failed` whose code is `auto_narration_paused`, which holds the
 *   pause for {@link AUTO_NARRATION_PAUSE_HOLD_MS}.
 * `refreshKey` re-checks the capabilities (the panel passes its settled-turn count).
 */
export function useAutoNarrationPause(
    api: Pick<ApiService, 'getVoiceCapabilities'>,
    active: boolean,
    refreshKey: number,
): AutoNarrationPause {
    const [capabilityPaused, setCapabilityPaused] = useState(false)
    const [heldUntil, setHeldUntil] = useState<number | null>(null)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        void Promise.resolve()
            .then(() => api.getVoiceCapabilities())
            .then((capabilities) => {
                if (!cancelled) setCapabilityPaused(capabilities.status.auto_narration_paused)
            })
            .catch(() => {
                // Fail open: keep the last reading.
            })
        return () => {
            cancelled = true
        }
    }, [active, api, refreshKey])

    useEffect(() => {
        if (heldUntil === null) return
        const timer = window.setTimeout(() => setHeldUntil(null), Math.max(0, heldUntil - Date.now()))
        return () => window.clearTimeout(timer)
    }, [heldUntil])

    const reportPaused = useCallback(() => setHeldUntil(Date.now() + AUTO_NARRATION_PAUSE_HOLD_MS), [])

    return { paused: heldUntil !== null || (active && capabilityPaused), reportPaused }
}
