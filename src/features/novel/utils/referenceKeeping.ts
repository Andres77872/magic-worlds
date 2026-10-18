/**
 * Which @references a proposal keeps (A10). Saved prose shows each Codex mention as `@Label`, and accepting a
 * proposal turns `@Label` back into that mention, so a reference the proposal drops or translates becomes plain text.
 */

export interface ReferenceCount { label: string; before: number; after: number }

// Markdown escapes the labels' punctuation; the counts compare the text the author reads.
const unescape = (text: string) => text.replace(/\\([\\`*_{}[\]<>~])/g, '$1')

/** Each `@` followed by the longest matching label, case-insensitively, as the editor's mention tokenizer reads it. */
function count(text: string, labels: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>(), plain = unescape(text), lower = plain.toLowerCase()
    for (let at = lower.indexOf('@'); at !== -1; at = lower.indexOf('@', at + 1)) {
        let best: string | null = null
        for (const label of labels) {
            const end = at + 1 + label.length
            if (lower.startsWith(label.toLowerCase(), at + 1) && !/[\p{L}\p{N}_@]/u.test(plain.charAt(end)) && (!best || label.length > best.length)) best = label
        }
        if (best) counts.set(best, (counts.get(best) ?? 0) + 1)
    }
    return counts
}

/** The references in the original, with how many times each appears before and after; empty when it has none. */
export function referenceKeeping(original: string, proposed: string, labels: readonly string[]): ReferenceCount[] {
    const named = [...new Set(labels.map((label) => label.trim()).filter(Boolean))]
    const before = count(original, named), after = count(proposed, named)
    return [...before].map(([label, times]) => ({ label, before: times, after: after.get(label) ?? 0 }))
}
