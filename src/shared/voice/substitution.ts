/**
 * Voice substitution reasons as the narration and call UI shows them
 * (R1-FE-04, 03 §5.10, 06 §9.7, 07 §5.2).
 *
 * - "Voice replaced" covers the reasons the BFF resolver substitutes a voice
 *   for (`REPLACED_REASONS`, resolver.py; R-7). `default_voice` (no voice was
 *   ever chosen) and `distinct_voice` (a same-voice collision in a group) are
 *   not replacements and show nothing.
 * - "Standard voice" is `tier_fallback`: Expressive was asked for, Standard
 *   played. A voice reason wins over it on the wire (R-12).
 * - `not_call_eligible` is call-only: the call speaks with a call voice.
 *
 * Every helper takes `unknown`: an unknown or future reason shows nothing.
 * Clips stored before these fields existed (no `substitution_reason`) never
 * produce a note.
 */
import type { ChatResponseSegmentKind, ChatTtsSegmentClip, VoiceSubstitutionReason } from '@/shared/types'

/** Mirrors the BFF resolver's `REPLACED_REASONS` (R-7). */
export const REPLACED_REASONS: ReadonlySet<VoiceSubstitutionReason> = new Set<VoiceSubstitutionReason>([
    'voice_removed',
    'voice_blocked',
    'voice_unavailable',
    'unmapped_legacy',
    'language_unsupported',
])

export function isReplacedReason(reason: unknown): reason is VoiceSubstitutionReason {
    return typeof reason === 'string' && REPLACED_REASONS.has(reason as VoiceSubstitutionReason)
}

export function isStandardFallback(reason: unknown): boolean {
    return reason === 'tier_fallback'
}

export function isCallVoiceReason(reason: unknown): boolean {
    return reason === 'not_call_eligible'
}

/** One speaker whose voice was replaced in a narrated turn. */
export interface ReplacedVoiceNote {
    /** Dedup key: `narrator`, the speaker's card id, its name, or null for an unnamed speaker. */
    speaker: string | null
    kind: ChatResponseSegmentKind | null
    /** The cast card id (`speaker_id`) a targeted refresh sends (R-30); null for the narrator. */
    cardId: string | null
    speakerName: string | null
    /** The voice that played. */
    voiceName: string | null
    /** The card's own voice, which was not available. */
    originalVoiceName: string | null
    reason: VoiceSubstitutionReason
}

export interface TurnVoiceNotes {
    /** At least one clip played Standard because Expressive was unavailable (N-09). */
    standardFallback: boolean
    /** One entry per replaced speaker, in clip order. */
    replaced: readonly ReplacedVoiceNote[]
}

/** No note: every turn that played as chosen, and every clip stored without the fields. */
export const NO_VOICE_NOTES: TurnVoiceNotes = Object.freeze({ standardFallback: false, replaced: Object.freeze([]) })

type NoteClip = Pick<ChatTtsSegmentClip, 'kind' | 'speaker_id' | 'speaker_name' | 'substitution_reason' | 'voice_name' | 'original_voice_name'>

function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

function speakerKey(clip: NoteClip): string | null {
    if (clip.kind === 'narrator') return 'narrator'
    return text(clip.speaker_id) ?? text(clip.speaker_name)
}

/** The notes of one narrated turn, deduplicated by speaker (the first clip of a speaker wins). */
export function turnVoiceNotes(clips: readonly NoteClip[] | null | undefined): TurnVoiceNotes {
    if (!clips || clips.length === 0) return NO_VOICE_NOTES
    let standardFallback = false
    const replaced: ReplacedVoiceNote[] = []
    const seen = new Set<string | null>()
    for (const clip of clips) {
        const reason = clip.substitution_reason
        if (isStandardFallback(reason)) {
            standardFallback = true
            continue
        }
        if (!isReplacedReason(reason)) continue
        const speaker = speakerKey(clip)
        if (seen.has(speaker)) continue
        seen.add(speaker)
        const narrator = clip.kind === 'narrator'
        replaced.push({
            speaker,
            kind: clip.kind ?? null,
            cardId: narrator ? null : text(clip.speaker_id),
            speakerName: narrator ? null : text(clip.speaker_name),
            voiceName: text(clip.voice_name),
            originalVoiceName: text(clip.original_voice_name),
            reason,
        })
    }
    if (!standardFallback && replaced.length === 0) return NO_VOICE_NOTES
    return { standardFallback, replaced }
}
