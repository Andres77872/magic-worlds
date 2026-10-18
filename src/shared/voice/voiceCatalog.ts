/**
 * Readers for the user catalog DTOs (D35, 03 §5.12, 08 §5.1) and the query
 * string of `GET /voices/catalog`. Dormant in R0: only the API client uses
 * them. Items without a `voice_key` or `display_name` are dropped; optional
 * fields default to null / empty so a partial server row never breaks a list.
 */
import type {
    CatalogPage,
    CatalogQuery,
    CatalogVoice,
    CatalogVoiceLanguage,
    CatalogVoiceStatus,
    NarrationTier,
} from '@/shared/types'

/** 08 §5.1: `limit ≤ 50` per page and `≤ 100` keys per batch lookup. */
export const CATALOG_PAGE_LIMIT_MAX = 50
export const CATALOG_KEYS_PER_REQUEST = 100

const STATUSES: readonly CatalogVoiceStatus[] = ['active', 'hidden', 'deprecating', 'removed', 'blocked']

type WireRecord = Record<string, unknown>

function record(value: unknown): WireRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as WireRecord) : null
}

function text(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : []
}

function tiers(value: unknown): NarrationTier[] {
    return Array.isArray(value) ? value.filter((entry): entry is NarrationTier => entry === 'standard' || entry === 'expressive') : []
}

function language(value: unknown): CatalogVoiceLanguage | null {
    const wire = record(value)
    const code = text(wire?.language)
    if (!wire || !code) return null
    return {
        language: code,
        native: wire.native === true,
        accent: text(wire.accent),
        accepted_models: tiers(wire.accepted_models),
        model_ids: strings(wire.model_ids).filter(id => ['eleven_v4', 'eleven_v4_turbo', 'drama-3', 's2.1-pro'].includes(id)),
        sample_url: typeof wire.sample_url === 'string' ? wire.sample_url : '',
    }
}

function replacement(value: unknown): CatalogVoice['replacement'] {
    const wire = record(value)
    const key = text(wire?.voice_key)
    return key ? { voice_key: key, display_name: text(wire?.display_name) ?? '' } : null
}

/** One catalog item, or null when it has no voice key or display name. */
export function toCatalogVoice(raw: unknown): CatalogVoice | null {
    const wire = record(raw)
    if (wire?.provider != null && wire.provider !== 'elevenlabs' && wire.provider !== 'fish_audio') return null
    const voiceKey = text(wire?.voice_key)
    const displayName = text(wire?.display_name)
    if (!wire || !voiceKey || !displayName) return null
    const languages = Array.isArray(wire.languages)
        ? wire.languages.map(language).filter((entry): entry is CatalogVoiceLanguage => entry !== null)
        : []
    const status = STATUSES.find((value) => value === wire.status) ?? 'active'
    return {
        voice_key: voiceKey,
        ...(wire.provider === 'fish_audio' ? { provider: 'fish_audio' as const, profile_id: text(wire.profile_id) ?? 'fish_drama_3' } : {}),
        display_name: displayName,
        description: text(wire.description),
        gender: text(wire.gender),
        age: text(wire.age),
        accent: text(wire.accent),
        primary_language: text(wire.primary_language) ?? languages[0]?.language ?? '',
        languages,
        tags: strings(wire.tags),
        house_voice: wire.house_voice === true,
        call_eligible: wire.call_eligible === true,
        status,
        disable_at: text(wire.disable_at),
        locked: wire.locked === true,
        min_plan: text(wire.min_plan),
        replacement: replacement(wire.replacement),
    }
}

/** The valid items of a `{ items }` body; anything else reads as no items. */
export function toCatalogItems(raw: unknown): CatalogVoice[] {
    const items = record(raw)?.items
    return Array.isArray(items) ? items.map(toCatalogVoice).filter((voice): voice is CatalogVoice => voice !== null) : []
}

/** A `{ items, next_cursor }` page; a missing cursor means the last page. */
export function toCatalogPage(raw: unknown): CatalogPage {
    return { items: toCatalogItems(raw), next_cursor: text(record(raw)?.next_cursor) }
}

/** Query string for `GET /voices/catalog` (03 §5.12 filters + the `after` cursor), with a leading `?` or empty. */
export function catalogQueryString(query: CatalogQuery = {}, cursor?: string | null): string {
    const search = new URLSearchParams()
    const put = (key: string, value: string | undefined | null) => {
        const trimmed = value?.trim()
        if (trimmed) search.set(key, trimmed)
    }
    put('language', query.language)
    put('provider', query.provider)
    put('accent', query.accent)
    put('gender', query.gender)
    put('age', query.age)
    const tags = (query.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
    if (tags.length > 0) search.set('tags', tags.join(','))
    put('use_case', query.use_case)
    if (typeof query.works_in_calls === 'boolean') search.set('works_in_calls', String(query.works_in_calls))
    put('q', query.q)
    put('recommended_for', query.recommended_for)
    if (typeof query.include_locked === 'boolean') search.set('include_locked', String(query.include_locked))
    put('after', cursor)
    if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
        search.set('limit', String(Math.min(CATALOG_PAGE_LIMIT_MAX, Math.max(1, Math.floor(query.limit)))))
    }
    const encoded = search.toString()
    return encoded ? `?${encoded}` : ''
}

/** Distinct, non-empty keys in request-sized batches (≤ 100 each). */
export function catalogKeyBatches(keys: readonly string[]): string[][] {
    const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
    const batches: string[][] = []
    for (let index = 0; index < unique.length; index += CATALOG_KEYS_PER_REQUEST) {
        batches.push(unique.slice(index, index + CATALOG_KEYS_PER_REQUEST))
    }
    return batches
}
