import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { useEffect, useMemo, useState } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { TurnEntry, TtsLifecycleStatus } from '@/shared/types'
import { readVoiceUsage, type VoiceUsageMeter } from '@/shared/voice/voiceUsage'

const IN_FLIGHT: ReadonlySet<TtsLifecycleStatus> = new Set<TtsLifecycleStatus>(['pending', 'in_progress', 'synthesizing', 'mirroring'])

export interface NarrationAllowance {
    /** Today's narration characters against the plan cap, once the server reports them (D24). */
    meter: VoiceUsageMeter | null
    /** The daily cap is used up: the meter says so, or a clip failed with `daily_limit_reached`. */
    limitReached: boolean
}

function settledNarrations(turns: readonly TurnEntry[]): number {
    let settled = 0
    for (const turn of turns) {
        if (turn.ttsStatus && !IN_FLIGHT.has(turn.ttsStatus)) settled += 1
    }
    return settled
}

function hitDailyLimit(turns: readonly TurnEntry[]): boolean {
    return turns.some((turn) =>
        turn.ttsError?.code === 'daily_limit_reached'
        || turn.ttsSegments?.some((segment) => segment.error?.code === 'daily_limit_reached') === true)
}

/**
 * Today's narration allowance for the narration controls (R0-FE-06). It reads
 * `GET /user/me` only while narration is in use (`active`: auto-narrate on, or
 * a clip requested here) and again each time a clip settles. A server without
 * the usage fields, or a failed read, leaves `meter` null and nothing shows.
 */
export function useNarrationAllowance(
    api: Pick<ApiService, 'getUserProfile'>,
    turns: readonly TurnEntry[],
    requestedActive: boolean,
): NarrationAllowance {
    useFeatureFlags()
    const active = requestedActive && isVoicesFeatureEnabled()
    const [meter, setMeter] = useState<VoiceUsageMeter | null>(null)
    const settled = settledNarrations(turns)
    const limitHit = useMemo(() => hitDailyLimit(turns), [turns])

    useEffect(() => {
        if (!active) return
        let cancelled = false
        void Promise.resolve()
            .then(() => api.getUserProfile())
            .then((profile) => {
                if (!cancelled) setMeter(readVoiceUsage(profile?.membership)?.narration ?? null)
            })
            .catch(() => {
                // Usage is a hint: keep the last reading.
            })
        return () => {
            cancelled = true
        }
    }, [active, api, settled])

    const shown = active ? meter : null
    return { meter: shown, limitReached: limitHit || (shown !== null && shown.remaining === 0) }
}
