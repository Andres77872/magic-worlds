/**
 * Break nudge timer (R2-BE-01 FE, 13 §2.7). `minutes` is
 * `readSafeguards(capabilities).break_nudge_minutes` (null: never nudge);
 * `active` is true while a call is live or narration is playing.
 *
 * - Activity counts across short pauses: only {@link BREAK_NUDGE_IDLE_RESET_MS}
 *   (15 min) without activity resets the count, and hides a showing nudge.
 * - After `minutes` of counted activity the nudge shows. It never stops
 *   playback; it waits for a dismissal.
 * - A dismissal snoozes it for another full interval of activity.
 *
 * Per tab and in memory only: a reload starts from zero.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Inactivity that counts as a break (13 §2.7 proposal). */
export const BREAK_NUDGE_IDLE_RESET_MS = 15 * 60_000

export interface BreakNudgeState {
    /** Show the nudge now. */
    visible: boolean
    /** Hide the nudge and snooze it for one interval. */
    dismiss: () => void
}

interface ActivityClock {
    /** Counted activity before the current active stretch. */
    accumulatedMs: number
    /** Start of the current active stretch. */
    activeSince: number | null
    /** A dismissal is waiting to clear the count when the timers restart. */
    snoozed: boolean
}

function intervalMs(minutes: number | null): number | null {
    return minutes !== null && Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : null
}

export function useBreakNudge(minutes: number | null, active: boolean): BreakNudgeState {
    const interval = intervalMs(minutes)
    const [shown, setShown] = useState(false)
    const [snoozes, setSnoozes] = useState(0)
    const clock = useRef<ActivityClock>({ accumulatedMs: 0, activeSince: null, snoozed: false })

    useEffect(() => {
        const state = clock.current
        if (state.snoozed) {
            state.accumulatedMs = 0
            state.snoozed = false
        }
        if (interval === null) {
            state.accumulatedMs = 0
            state.activeSince = null
            return undefined
        }
        if (active) {
            state.activeSince = Date.now()
            const timer = window.setTimeout(() => setShown(true), Math.max(0, interval - state.accumulatedMs))
            return () => {
                window.clearTimeout(timer)
                if (state.activeSince !== null) state.accumulatedMs += Date.now() - state.activeSince
                state.activeSince = null
            }
        }
        // Idle: a long enough break resets the count and retires a showing nudge.
        const idle = window.setTimeout(() => {
            state.accumulatedMs = 0
            setShown(false)
        }, BREAK_NUDGE_IDLE_RESET_MS)
        return () => window.clearTimeout(idle)
    }, [active, interval, snoozes])

    const dismiss = useCallback(() => {
        clock.current.snoozed = true
        setShown(false)
        setSnoozes((value) => value + 1)
    }, [])

    const visible = interval !== null && shown
    return useMemo(() => ({ visible, dismiss }), [visible, dismiss])
}
