import { useEffect, type RefObject } from 'react'
import type { VoiceRefreshState } from '../../hooks/useVoiceRefresh'

/** How long "Voice updated" stays after a refresh before the indicator settles. */
export const REFRESH_DONE_VISIBLE_MS = 5_000

/**
 * A successful D36 refresh usually removes the indicator that offered it (the
 * voices match again), so its "Voice updated" line is kept briefly and then
 * cleared. Errors stay until the next attempt: the action remains available.
 *
 * `hold` is the status line the action moved focus to: while it still holds
 * focus the line stays, and it clears once focus leaves it, so settling never
 * drops keyboard focus to the page.
 */
export function useDoneReset(
    refresh: Pick<VoiceRefreshState, 'status' | 'reset'>,
    hold?: RefObject<HTMLElement | null>,
): void {
    const { status, reset } = refresh
    useEffect(() => {
        if (status !== 'done') return
        let held: HTMLElement | null = null
        const release = () => reset()
        const timer = window.setTimeout(() => {
            const node = hold?.current ?? null
            if (node && node.contains(document.activeElement)) {
                held = node
                node.addEventListener('focusout', release, { once: true })
                return
            }
            reset()
        }, REFRESH_DONE_VISIBLE_MS)
        return () => {
            window.clearTimeout(timer)
            held?.removeEventListener('focusout', release)
        }
    }, [status, reset, hold])
}
