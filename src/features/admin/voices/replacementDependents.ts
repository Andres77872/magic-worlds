/**
 * Replacement dependents (03 §5.16 I-29/I-34): the voices whose
 * `replacement_voice_key` is another voice. A catalog PATCH that would make that
 * voice ineligible answers 409 `voice_is_replacement` unless
 * `?repoint_dependents_to=` names a valid target (422 `repoint_target_invalid`
 * otherwise). The mass-removal override never refuses: it reports the voices it
 * left without a valid replacement as `replacement_orphans=<n>` in its `detail`.
 */
import { ApiError } from '@/infrastructure/api'
import { VOICE_IS_REPLACEMENT_CODE } from './publishFailures'

export const REPOINT_TARGET_INVALID_CODE = 'repoint_target_invalid'

export interface ReplacementDependents {
    /** `dependent_voice_keys`, in the server's order. */
    keys: string[]
    /** Per dependent key, the `replacement_problem` code the change would cause. */
    reasons: Record<string, string>
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== ''
}

/** The dependents of a 409 `voice_is_replacement`; null for any other error or an empty list. */
export function replacementDependentsOf(error: unknown): ReplacementDependents | null {
    if (!(error instanceof ApiError) || error.code !== VOICE_IS_REPLACEMENT_CODE) return null
    const rawKeys = error.details?.dependent_voice_keys
    const keys = Array.isArray(rawKeys) ? [...new Set(rawKeys.filter(nonEmptyString).map((key) => key.trim()))] : []
    if (keys.length === 0) return null
    const rawReasons = error.details?.reasons
    const reasons: Record<string, string> = {}
    if (rawReasons && typeof rawReasons === 'object' && !Array.isArray(rawReasons)) {
        for (const [key, reason] of Object.entries(rawReasons as Record<string, unknown>)) {
            if (keys.includes(key) && nonEmptyString(reason)) reasons[key] = reason
        }
    }
    return { keys, reasons }
}

export interface RepointRefusal {
    /** The first dependent the target does not fit; null when the target is not a voice key at all. */
    voiceKey: string | null
    /** Its `replacement_problem` code (`replacement_not_found` for a malformed key); null when not sent. */
    reason: string | null
}

/** The 422 `repoint_target_invalid` refusal; null for any other error. */
export function repointRefusalOf(error: unknown): RepointRefusal | null {
    if (!(error instanceof ApiError) || error.code !== REPOINT_TARGET_INVALID_CODE) return null
    const voiceKey = error.details?.voice_key
    const reason = error.details?.reason
    return { voiceKey: nonEmptyString(voiceKey) ? voiceKey : null, reason: nonEmptyString(reason) ? reason : null }
}

const ORPHANS_PATTERN = /(?:^|\s)replacement_orphans=(\d+)(?=\s|$)/

/**
 * `replacement_orphans` from a sync answer's `detail`
 * (`"removed=1 present=0 errors=0 skipped=0 replacement_orphans=2"`); 0 when absent.
 */
export function replacementOrphans(detail: string | null | undefined): number {
    if (typeof detail !== 'string') return 0
    const match = ORPHANS_PATTERN.exec(detail)
    return match ? Number.parseInt(match[1], 10) : 0
}
