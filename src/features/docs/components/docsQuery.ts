/**
 * The active (normalized) docs search query, shared with every text block so
 * matches can be marked without threading the query through each card's props.
 */
import { createContext, useContext } from 'react'

export const DocsQueryContext = createContext('')

export function useDocsQuery(): string {
    return useContext(DocsQueryContext)
}

/** Split `text` around case-insensitive occurrences of an already-lowercased `query`. */
export function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
    if (!query) return [{ text, match: false }]
    const lower = text.toLowerCase()
    // Lowercasing can change length for a few code points (e.g. "İ"); offsets
    // would drift, so leave such text unmarked rather than mis-highlight it.
    if (lower.length !== text.length) return [{ text, match: false }]
    const parts: { text: string; match: boolean }[] = []
    let from = 0
    let index = lower.indexOf(query)
    while (index !== -1) {
        if (index > from) parts.push({ text: text.slice(from, index), match: false })
        parts.push({ text: text.slice(index, index + query.length), match: true })
        from = index + query.length
        index = lower.indexOf(query, from)
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false })
    return parts
}
