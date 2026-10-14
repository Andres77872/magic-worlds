/**
 * Remove the read-only voice projections (D35, 09 §1.2) before a write: the
 * BFF write models are `extra="forbid"`. Removes `effective_voice` (next to a
 * card / preset / cast entry / chat character `voice`) and
 * `effective_narrator_voice` (next to an adventure `narrator_voice`) anywhere
 * in the document.
 *
 * Copy-on-write and pure: only the objects on the path to a removed key are
 * copied; every other subtree, and every stored voice object (`voice`,
 * `narrator_voice`, never descended into), keeps its reference, so untouched
 * voices are re-sent byte-identical (D32).
 */

export const VOICE_PROJECTION_KEYS: ReadonlySet<string> = new Set(['effective_voice', 'effective_narrator_voice'])

/** Stored voice paths: written back untouched, never rewritten. */
const STORED_VOICE_KEYS: ReadonlySet<string> = new Set(['voice', 'narrator_voice'])

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

function strip(value: unknown): unknown {
    if (Array.isArray(value)) {
        let changed = false
        const next = value.map((item) => {
            const stripped = strip(item)
            if (stripped !== item) changed = true
            return stripped
        })
        return changed ? next : value
    }
    if (!isPlainObject(value)) return value
    let next: Record<string, unknown> | null = null
    for (const [key, child] of Object.entries(value)) {
        if (VOICE_PROJECTION_KEYS.has(key)) {
            next ??= { ...value }
            delete next[key]
            continue
        }
        if (STORED_VOICE_KEYS.has(key)) continue
        const stripped = strip(child)
        if (stripped !== child) {
            next ??= { ...value }
            next[key] = stripped
        }
    }
    return next ?? value
}

export function stripVoiceProjections<T>(doc: T): T {
    return strip(doc) as T
}
