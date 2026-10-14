/**
 * D36 "Use the card's current voice" (R1-FE-04; 05 §7.8, 09 §4.4-4.5,
 * AC-C6): when a session's voice no longer matches its source card.
 *
 * Both inputs are read-only `effective_voice` projections (D35). The BFF sends
 * them to authenticated callers next to stored voices; an absent projection
 * (an older session, a share-link reader) never yields a drift.
 *
 * - `replaced`: the session voice is a forced substitution (the R-7 reasons or
 *   the `replaced` badge). It shows the "Voice replaced" indicator.
 * - `differs`: the session plays another voice than the card plays now
 *   (different `voice_key`, 03 §5.13) and the card's voice can be copied.
 *   Only then can the refresh change anything, so only then is the action
 *   offered. A `distinct_voice` substitution (D33: two cast members on one
 *   voice) is by design and does not count. Without a card projection (the
 *   card is not in the session's library, D39 item 6) nothing differs.
 *
 * The refresh judges the copied voice as a new pick (D32/D36, R-9): a V1 card
 * voice that translates only to a D31 default is refused, and so is any voice
 * that is not active in the catalog (BFF `refreshed_voice_v2` and
 * `_validate_v2_pick`, `voice_not_eligible`). A card projection that shows one
 * of those (`notCopyable`) never offers an action that is bound to fail; the
 * user fixes the card first (05 §7.8 owner prompts).
 */
import type { EffectiveVoice, StoredCharacterVoice, VoiceBadgeKey, VoiceSubstitutionReason } from '@/shared/types'
import { isElevenLabsProjection, isReplacedReason, isVoiceV2, parseStoredVoice, readEffectiveVoice } from '@/shared/voice'

export interface SessionVoiceDrift {
    replaced: boolean
    differs: boolean
    /** The voice the session plays (projection display name). */
    sessionName: string | null
    /** The voice the source card plays now. */
    cardName: string | null
}

/** One cast member of an adventure whose voice drifted from its card. */
export interface CastVoiceDrift extends SessionVoiceDrift {
    /** The snapshot cast entry id, which is the library card id the refresh copies from (R-30). */
    cardId: string
    name: string
}

export interface CastVoiceInput {
    cardId: string | null | undefined
    name: string | null | undefined
    /** The session projection of this cast entry (`effective_voice`). */
    effective: unknown
}

function nonEmpty(value: string | null | undefined): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed || null
}

function elevenLabs(raw: unknown): EffectiveVoice | null {
    const effective = readEffectiveVoice(raw)
    return isElevenLabsProjection(effective) ? effective : null
}

/**
 * Card projections whose stored voice the refresh refuses to copy:
 * - `unmapped_legacy` / `needs_reselect`: a V1 voice with no mapping, translated
 *   to a D31 default (`defaulted_review`);
 * - `voice_removed`, `voice_blocked`, `voice_unavailable`, `retired` (hidden) and
 *   `leaving` (deprecating): the stored voice is not `active`;
 * - `default_voice`: the stored value is not a readable voice.
 * `language_unsupported` is not here: the voice itself is eligible, and the
 * session may play it in its own language.
 */
const NOT_COPYABLE_REASONS: ReadonlySet<VoiceSubstitutionReason> = new Set<VoiceSubstitutionReason>([
    'unmapped_legacy',
    'voice_removed',
    'voice_blocked',
    'voice_unavailable',
    'default_voice',
])
const NOT_COPYABLE_BADGES: ReadonlySet<VoiceBadgeKey> = new Set<VoiceBadgeKey>(['needs_reselect', 'retired', 'leaving'])

/** True when the card's current voice cannot be copied by a refresh (see above). */
export function notCopyable(card: EffectiveVoice): boolean {
    return (card.substitution_reason !== null && NOT_COPYABLE_REASONS.has(card.substitution_reason))
        || card.badges.some((badge) => NOT_COPYABLE_BADGES.has(badge))
}

/** The drift of one session voice against its card's current voice, or null when there is nothing to show. */
export function sessionVoiceDrift(sessionRaw: unknown, cardRaw: unknown): SessionVoiceDrift | null {
    const session = elevenLabs(sessionRaw)
    if (!session) return null
    const card = elevenLabs(cardRaw)
    const replaced = session.badges.includes('replaced') || isReplacedReason(session.substitution_reason)
    const differs = Boolean(
        card
        && !notCopyable(card)
        && session.substitution_reason !== 'distinct_voice'
        && session.voice_key
        && card.voice_key
        && session.voice_key !== card.voice_key,
    )
    if (!replaced && !differs) return null
    return {
        replaced,
        differs,
        sessionName: nonEmpty(session.display_name),
        cardName: card ? nonEmpty(card.display_name) : null,
    }
}

/** The cast members whose voice differs from their card (the refreshable ones), in cast order. */
export function castVoiceDrift(
    entries: readonly CastVoiceInput[],
    cardVoice: (cardId: string) => unknown,
): CastVoiceDrift[] {
    const drifted: CastVoiceDrift[] = []
    const seen = new Set<string>()
    for (const entry of entries) {
        const cardId = nonEmpty(entry.cardId)
        if (!cardId || seen.has(cardId)) continue
        seen.add(cardId)
        const drift = sessionVoiceDrift(entry.effective, cardVoice(cardId))
        if (drift?.differs) drifted.push({ ...drift, cardId, name: nonEmpty(entry.name) ?? '' })
    }
    return drifted
}

/** The refresh route takes 1..6 card ids per request (`MAX_REFRESH_CARD_IDS`, EP-2). */
export const MAX_REFRESH_CARD_IDS = 6

export function refreshBatches(cardIds: readonly string[]): string[][] {
    const unique = [...new Set(cardIds)]
    const batches: string[][] = []
    for (let index = 0; index < unique.length; index += MAX_REFRESH_CARD_IDS) {
        batches.push(unique.slice(index, index + MAX_REFRESH_CARD_IDS))
    }
    return batches
}

/** A stored voice and its projection, as a session holds them. */
export interface StoredVoicePair {
    voice: StoredCharacterVoice | null | undefined | unknown
    effective: unknown
}

/**
 * The first-exposure condition for a session (D35, 05 §7.6): a stored V1
 * (legacy) voice that now plays through an ElevenLabs projection.
 */
export function hasConvertedVoice(pairs: readonly StoredVoicePair[]): boolean {
    return pairs.some(({ voice, effective }) => {
        const stored = parseStoredVoice(voice)
        return Boolean(stored && !isVoiceV2(stored) && elevenLabs(effective))
    })
}
