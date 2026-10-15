/**
 * Tracks which of `ids` is the topmost section in the reading band, for the
 * "On this page" nav's `aria-current`. Sections hidden by search (or by an
 * inactive view) stop intersecting, so they never become active. `ids` must be
 * referentially stable (a module constant or a memo).
 */
import { useEffect, useRef, useState } from 'react'

/** Top offset clears the app chrome; the bottom cut keeps "active" in the upper part of the screen. */
const READING_BAND = '-96px 0px -58% 0px'

export function useScrollSpy(ids: readonly string[], enabled = true) {
    const [active, setActive] = useState(ids[0])
    const visible = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!enabled || typeof IntersectionObserver === 'undefined') return

        visible.current = new Set()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.current.add(entry.target.id)
                    else visible.current.delete(entry.target.id)
                }
                const topmost = ids.find((id) => visible.current.has(id))
                if (topmost) setActive(topmost)
            },
            { rootMargin: READING_BAND, threshold: 0 },
        )

        for (const id of ids) {
            const element = document.getElementById(id)
            if (element) observer.observe(element)
        }
        return () => observer.disconnect()
    }, [ids, enabled])

    return [active, setActive] as const
}
