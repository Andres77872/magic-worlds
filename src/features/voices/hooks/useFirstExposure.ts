/**
 * "Voices have a new engine" is shown once per account and browser
 * (R1-FE-03, 09 §7). The dismissal lives in localStorage under a key that
 * carries the user hash; there is no server endpoint for it (§5 of the R1
 * build). Every storage access is guarded: when storage throws (private mode,
 * quota, blocked), the dismissal is remembered in memory for the mount.
 */
import { useCallback, useState } from 'react'

export const FIRST_EXPOSURE_KEY_PREFIX = 'magic_worlds:voice_first_exposure:v1:'

export function firstExposureKey(userHash: string): string {
    return `${FIRST_EXPOSURE_KEY_PREFIX}${userHash}`
}

function readDismissed(userHash: string | null | undefined): boolean {
    if (!userHash) return true
    try {
        return window.localStorage.getItem(firstExposureKey(userHash)) === '1'
    } catch {
        return false
    }
}

export interface FirstExposureState {
    /** True until dismissed; always false without a signed-in user. */
    visible: boolean
    dismiss: () => void
}

export function useFirstExposure(userHash: string | null | undefined): FirstExposureState {
    // Keyed by user: a different account starts from its own stored answer.
    const [dismissedFor, setDismissedFor] = useState<Record<string, boolean>>({})
    const hash = typeof userHash === 'string' && userHash.trim() ? userHash.trim() : null
    const dismissed = hash ? (dismissedFor[hash] ?? readDismissed(hash)) : true

    const dismiss = useCallback(() => {
        if (!hash) return
        setDismissedFor((current) => ({ ...current, [hash]: true }))
        try {
            window.localStorage.setItem(firstExposureKey(hash), '1')
        } catch {
            // In-memory only for this mount.
        }
    }, [hash])

    return { visible: !dismissed, dismiss }
}
