/**
 * Voice safety pause state for one chat surface (R2-BE-01 FE, WN-3). The
 * chat socket's `voice_safety_notice` frame is routed to `onNotice`; while
 * `isPaused`, narration controls are disabled, and `noticeOpen` drives the
 * `SafetyPauseNotice` modal until the user dismisses it.
 *
 * - A frame with `retry_after_seconds` pauses until then; without one the
 *   pause holds for the life of the surface (the server keeps refusing voice
 *   with `voice_safety_pause` anyway).
 * - `pausedUntil` (optional) seeds a pause the server already reports, e.g.
 *   `readSafeguards(capabilities).paused_until`: voice stays disabled until
 *   then, without opening the notice again.
 * - Without a frame or a `paused_until` nothing is paused, so a surface the
 *   server never pauses keeps its normal behaviour.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { VoiceSafetyNoticeFrame } from '@/shared/types/interaction.types'

export interface SafetyPauseState {
    /** Feed a `voice_safety_notice` frame from the chat socket. */
    onNotice: (frame: VoiceSafetyNoticeFrame) => void
    /** Voice is paused: narration controls stay disabled. */
    isPaused: boolean
    /** When the pause ends, as epoch milliseconds; null when unknown or not paused. */
    pausedUntil: number | null
    /** The frame's `retry_after_seconds`, for the notice copy. */
    retryAfterSeconds: number | null
    /** The pause notice modal is showing (paused and not yet dismissed). */
    noticeOpen: boolean
    /** Close the notice. The pause itself holds until it ends. */
    dismiss: () => void
}

interface LivePause {
    /** Epoch ms; null when the server gave no end. */
    until: number | null
    retryAfterSeconds: number | null
    noticeOpen: boolean
}

/** A non-negative whole number of seconds, else null. */
function seconds(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.ceil(value) : null
}

function parseInstant(value: string | null | undefined): number | null {
    if (!value) return null
    const at = Date.parse(value)
    return Number.isFinite(at) ? at : null
}

export function useSafetyPause(pausedUntil?: string | null): SafetyPauseState {
    const [live, setLive] = useState<LivePause | null>(null)
    /** The seeded instant that has already passed (so it no longer pauses). */
    const [expiredSeed, setExpiredSeed] = useState<number | null>(null)
    const parsedSeed = parseInstant(pausedUntil)
    const seeded = parsedSeed !== null && parsedSeed !== expiredSeed ? parsedSeed : null

    const onNotice = useCallback((frame: VoiceSafetyNoticeFrame) => {
        if (frame?.type !== 'voice_safety_notice') return
        const retry = seconds(frame.retry_after_seconds)
        setLive({ until: retry === null ? null : Date.now() + retry * 1000, retryAfterSeconds: retry, noticeOpen: true })
    }, [])

    const dismiss = useCallback(() => {
        setLive((current) => (current && current.noticeOpen ? { ...current, noticeOpen: false } : current))
    }, [])

    // A timed live pause ends on its own.
    useEffect(() => {
        if (!live || live.until === null) return undefined
        const ended = live
        const delay = Math.max(0, live.until - Date.now())
        const timer = window.setTimeout(() => setLive((current) => (current === ended ? null : current)), delay)
        return () => window.clearTimeout(timer)
    }, [live])

    // So does a seeded one (an instant already past ends at once).
    useEffect(() => {
        if (seeded === null) return undefined
        const timer = window.setTimeout(() => setExpiredSeed(seeded), Math.max(0, seeded - Date.now()))
        return () => window.clearTimeout(timer)
    }, [seeded])

    const isPaused = live !== null || seeded !== null
    // An open-ended live pause outlasts a timed one; otherwise the later end wins.
    const until = live !== null && live.until === null
        ? null
        : Math.max(live?.until ?? -Infinity, seeded ?? -Infinity)
    const pauseEnd = isPaused && Number.isFinite(until) ? until : null
    const retryAfterSeconds = live?.retryAfterSeconds ?? null
    const noticeOpen = live?.noticeOpen === true

    return useMemo(
        () => ({ onNotice, isPaused, pausedUntil: pauseEnd, retryAfterSeconds, noticeOpen, dismiss }),
        [onNotice, isPaused, pauseEnd, retryAfterSeconds, noticeOpen, dismiss],
    )
}
