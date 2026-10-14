/**
 * Tolerant reader for the read-only `effective_voice` / `effective_narrator_voice`
 * projections (D35, 03 §5.12, R1-FE-03). The BFF sends them to every
 * authenticated caller next to stored voices; they are absent when the resolver
 * is not wired and for anonymous share-link readers, so absence stays normal.
 *
 * `isElevenLabsProjection` is the per-document gate: badges, the "Plays as"
 * line and any other R1 projection UI render only when a projection is present.
 */
import type { EffectiveVoice, VoiceBadgeKey, VoiceSubstitutionReason } from '@/shared/types'

const BADGE_KEYS: ReadonlySet<string> = new Set<VoiceBadgeKey>([
    'leaving', 'needs_reselect', 'retired', 'replaced', 'call_voice',
    'locked', 'expressive_only', 'standard_fallback', 'not_tested_language', 'house_voice',
])

const SUBSTITUTION_REASONS: ReadonlySet<string> = new Set<VoiceSubstitutionReason>([
    'voice_removed', 'voice_unavailable', 'voice_blocked',
    'not_call_eligible', 'default_voice', 'distinct_voice', 'language_unsupported', 'tier_fallback',
])

export function isVoiceBadgeKey(value: unknown): value is VoiceBadgeKey {
    return typeof value === 'string' && BADGE_KEYS.has(value)
}

export function isSubstitutionReason(value: unknown): value is VoiceSubstitutionReason {
    return typeof value === 'string' && SUBSTITUTION_REASONS.has(value)
}

/**
 * The projection as a typed value, or null when it is absent or not a
 * projection (a `provider_route` other than `elevenlabs`; a missing route reads
 * as `elevenlabs`, the only one). Malformed fields degrade instead
 * of failing: a non-string `display_name` reads as '' (callers then fall back
 * to the stored name), unknown badges are dropped, unknown substitution
 * reasons read as null.
 */
export function readEffectiveVoice(raw: unknown): EffectiveVoice | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
    const wire = raw as Record<string, unknown>
    const route = wire.provider_route
    if (route !== undefined && route !== null && route !== 'elevenlabs') return null
    const badges = Array.isArray(wire.badges) ? wire.badges.filter(isVoiceBadgeKey) : []
    return {
        voice_key: typeof wire.voice_key === 'string' ? wire.voice_key : null,
        display_name: typeof wire.display_name === 'string' ? wire.display_name : '',
        provider_route: 'elevenlabs',
        substitution_reason: isSubstitutionReason(wire.substitution_reason) ? wire.substitution_reason : null,
        badges: [...new Set(badges)],
    }
}

/** The per-document R1 gate: true when a projection is present (every projection is ElevenLabs). */
export function isElevenLabsProjection(effective: EffectiveVoice | null | undefined): effective is EffectiveVoice {
    return typeof effective === 'object' && effective !== null
}
