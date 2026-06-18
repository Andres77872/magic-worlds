/**
 * Position-aware lorebook trigger scanner.
 *
 * The activation engine in `lorebookTransforms.ts` answers "does this entry fire?"
 * (booleans + which keys matched). For inline marking we need the opposite: *where*
 * in a piece of text each key occurs, so we can wrap those ranges. This module shares
 * the exact key→regex semantics (`buildKeyRegex`, also used by `matchKey`) and adds
 * range extraction, overlap resolution, and segmentation for rendering.
 */
import type { LorebookEntry } from '@/shared'

export type KeyMatchOptions = {
    caseSensitive: boolean
    matchWholeWords: boolean
    regex: boolean
}

/** A single session-attached entry plus the name of the lorebook it came from. */
export interface SessionLoreEntry {
    entry: LorebookEntry
    lorebookId: string
    lorebookName: string
}

/** A literal hit of a trigger key inside scanned text. */
export interface TriggerMatch {
    /** Inclusive start offset into the scanned string. */
    start: number
    /** Exclusive end offset. */
    end: number
    /** The substring actually matched (preserves the text's own casing). */
    keyword: string
    entry: LorebookEntry
    lorebookName: string
}

interface CompiledKey {
    regex: RegExp
    entry: LorebookEntry
    lorebookName: string
}

/** Opaque, precompiled scan index. Build once per session-entry set, reuse per scan. */
export interface TriggerMatcher {
    keys: CompiledKey[]
}

/**
 * Compile one key into a RegExp, mirroring `matchKey`'s rules: regex keys are used
 * verbatim; literal keys are escaped and (optionally) wrapped in word boundaries.
 * Whole-word boundaries use zero-width lookarounds (not the consuming `[^\w]` form)
 * so match offsets are exact for scanning. Returns null for empty/invalid keys.
 */
export function buildKeyRegex(
    key: string,
    options: KeyMatchOptions,
    { global = false }: { global?: boolean } = {},
): RegExp | null {
    const needle = key.trim()
    if (!needle) return null
    const flags = `${options.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`
    try {
        if (options.regex) {
            return new RegExp(needle, flags)
        }
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = options.matchWholeWords
            ? `(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`
            : escaped
        return new RegExp(pattern, flags)
    } catch {
        return null
    }
}

function optionsForEntry(entry: LorebookEntry): KeyMatchOptions {
    // Normalized entries always carry these flags explicitly, so this matches the
    // activation engine's `entryMatchOptions` (which only falls back to lorebook
    // settings when an entry omits them — drafts, not persisted entries).
    return { caseSensitive: entry.caseSensitive, matchWholeWords: entry.matchWholeWords, regex: entry.regex }
}

/**
 * Precompile a scan index from session-attached entries. Skips entries that can't or
 * shouldn't be surfaced inline: disabled, secret (don't spoil hidden lore), and those
 * without primary keys (constant entries have no literal trigger to mark). Only
 * primary `keys` are marked — secondary keys gate selective logic, not triggering.
 */
export function buildTriggerMatcher(entries: SessionLoreEntry[]): TriggerMatcher {
    const keys: CompiledKey[] = []
    for (const { entry, lorebookName } of entries) {
        if (!entry.enabled || entry.isSecret || entry.keys.length === 0) continue
        const options = optionsForEntry(entry)
        for (const key of entry.keys) {
            const regex = buildKeyRegex(key, options, { global: true })
            if (regex) keys.push({ regex, entry, lorebookName })
        }
    }
    return { keys }
}

export function matcherIsEmpty(matcher: TriggerMatcher | null | undefined): boolean {
    return !matcher || matcher.keys.length === 0
}

/**
 * Find every trigger hit in `text`, resolved to a non-overlapping set with
 * longest-match-wins (so "Iron Citadel" beats a nested "Iron"), sorted by start.
 */
export function scanText(text: string, matcher: TriggerMatcher | null | undefined): TriggerMatch[] {
    if (!text || matcherIsEmpty(matcher)) return []
    const raw: TriggerMatch[] = []
    for (const { regex, entry, lorebookName } of matcher!.keys) {
        try {
            for (const m of text.matchAll(regex)) {
                const value = m[0]
                if (!value) continue // guard against zero-width regex matches
                const start = m.index ?? 0
                raw.push({ start, end: start + value.length, keyword: value, entry, lorebookName })
            }
        } catch {
            // A malformed/global-incompatible regex is simply skipped (as matchKey does).
        }
    }
    if (raw.length === 0) return []
    // Longest first at any given start, then greedily drop anything that overlaps a
    // match we already kept.
    raw.sort((a, b) => a.start - b.start || b.end - a.end)
    const resolved: TriggerMatch[] = []
    let lastEnd = -1
    for (const match of raw) {
        if (match.start >= lastEnd) {
            resolved.push(match)
            lastEnd = match.end
        }
    }
    return resolved
}

export interface TextSegment {
    text: string
    /** Present when this segment is a trigger hit. */
    match?: TriggerMatch
}

/** Split `text` into plain + trigger segments using already-resolved matches. */
export function segmentText(text: string, matches: TriggerMatch[]): TextSegment[] {
    if (matches.length === 0) return text ? [{ text }] : []
    const segments: TextSegment[] = []
    let cursor = 0
    for (const match of matches) {
        if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) })
        segments.push({ text: text.slice(match.start, match.end), match })
        cursor = match.end
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor) })
    return segments
}
