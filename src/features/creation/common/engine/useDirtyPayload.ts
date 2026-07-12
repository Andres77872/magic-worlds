/**
 * useDirtyPayload — dirty tracking by serialized-payload comparison.
 *
 * Creators already build their full payload every render (it feeds the card
 * assistant), so the caller passes `JSON.stringify(buildPayload())` and this
 * hook compares it against the last clean baseline.
 *
 * Two ways to re-baseline:
 * - `markClean(serializedPayload)` — after a successful save, with the exact
 *   payload that was persisted.
 * - `markClean()` — alongside hydration setters (card load, draft restore,
 *   discard). Deferred to after the commit so the baseline includes the state
 *   those setters are about to apply. Only valid when a re-render is
 *   guaranteed (i.e. state setters were called in the same handler).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface DirtyPayloadApi {
    dirty: boolean
    markClean: (serialized?: string) => void
}

export function useDirtyPayload(serialized: string): DirtyPayloadApi {
    const [baseline, setBaseline] = useState(serialized)
    const pendingCleanRef = useRef(false)

    // Runs on every render on purpose: a no-arg markClean() must re-baseline
    // against whatever the accompanying hydration setters produced, even when
    // the serialized payload happens to be unchanged (the guard clears the
    // pending flag either way, so no update chain can start).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!pendingCleanRef.current) return
        pendingCleanRef.current = false
        setBaseline(serialized)
    })

    const markClean = useCallback((next?: string) => {
        if (next !== undefined) {
            pendingCleanRef.current = false
            setBaseline(next)
            return
        }
        pendingCleanRef.current = true
    }, [])

    return { dirty: serialized !== baseline, markClean }
}
