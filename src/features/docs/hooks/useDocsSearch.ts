/**
 * Docs search state: the raw query, its normalized form, a debounced copy for
 * the screen-reader status message (announcing every keystroke is noise), and
 * the Ctrl/⌘+K focus shortcut. A modifier shortcut — not a bare "/" — keeps it
 * clear of WCAG 2.1.4 (character key shortcuts) and of typing in other fields.
 */
import { useEffect, useState, type RefObject } from 'react'

const ANNOUNCE_DELAY_MS = 450

export function normalizeQuery(query: string): string {
    return query.trim().toLowerCase()
}

export function useDocsSearch(inputRef: RefObject<HTMLInputElement | null>) {
    const [query, setQuery] = useState('')
    const normalized = normalizeQuery(query)
    const [settled, setSettled] = useState(normalized)

    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(normalized), ANNOUNCE_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [normalized])

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
                event.preventDefault()
                inputRef.current?.focus()
                inputRef.current?.select()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [inputRef])

    /** `settled` is true once typing pauses — gate the live-region announcement on it. */
    return { query, setQuery, normalized, settled: settled === normalized }
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere — for the visible shortcut hint. */
export function modifierKeyLabel(): string {
    if (typeof navigator === 'undefined') return 'Ctrl'
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? ''
    return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl'
}

