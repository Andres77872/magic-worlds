/**
 * useWordGoal — a per-chapter word target persisted in localStorage. Returns the
 * current goal (null when unset) and a setter that writes through. Keyed by story
 * + chapter so each chapter keeps its own target.
 */

import { useCallback, useEffect, useState } from 'react'

const KEY_PREFIX = 'magic_worlds:novel:wordGoal'

function storageKey(storyId: string | null, chapterId: string | null): string | null {
    if (!storyId || !chapterId) return null
    return `${KEY_PREFIX}:${storyId}:${chapterId}`
}

function readGoal(key: string | null): number | null {
    if (!key) return null
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        const value = Number.parseInt(raw, 10)
        return Number.isFinite(value) && value > 0 ? value : null
    } catch {
        return null
    }
}

export interface WordGoalApi {
    goal: number | null
    setGoal: (goal: number | null) => void
}

export function useWordGoal(storyId: string | null, chapterId: string | null): WordGoalApi {
    const key = storageKey(storyId, chapterId)
    const [goal, setGoalState] = useState<number | null>(() => readGoal(key))

    // Re-read when the active chapter changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGoalState(readGoal(key))
    }, [key])

    const setGoal = useCallback(
        (next: number | null) => {
            const normalized = next && next > 0 ? Math.round(next) : null
            setGoalState(normalized)
            if (!key) return
            try {
                if (normalized) window.localStorage.setItem(key, String(normalized))
                else window.localStorage.removeItem(key)
            } catch {
                // Storage unavailable — keep the in-memory state.
            }
        },
        [key],
    )

    return { goal, setGoal }
}
