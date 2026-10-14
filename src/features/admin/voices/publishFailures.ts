/**
 * The BFF's publish and replacement refusals (08 §5.3; `publish_blockers` and
 * `replacement_problem` in the R0 console-api build). A publish answers 422
 * `publish_precondition_failed` with `failed: string[]`; each entry is a code with
 * an optional `:<language>` suffix (`expressive_not_passed:es`). A replacement,
 * visibility or status refusal answers its own code instead.
 */
import type { TFunction } from 'i18next'
import { ApiError } from '@/infrastructure/api'

export interface PublishFailure {
    code: string
    /** ISO 639 code from the `:<lang>` suffix; null when the code has none. */
    language: string | null
    /**
     * `voice_is_replacement` (409, I-29): the voices that use this one as their
     * replacement and that the change would invalidate (`dependent_voice_keys`).
     */
    dependentVoiceKeys?: string[]
}

/** Codes whose copy names a language. */
const LANGUAGE_CODES = new Set(['flash_not_passed', 'call_consistency_low', 'expressive_not_passed', 'no_own_sample', 'no_expressive_sample'])

/** Every code with its own copy under `admin.voices.publishFailures.*`. */
export const PUBLISH_FAILURE_CODES: ReadonlySet<string> = new Set([
    ...LANGUAGE_CODES,
    'premade_banned',
    'library_publish_blocked',
    'ivc_publish_blocked',
    'source_not_allowed',
    'not_call_eligible',
    'no_accepted_language',
    'replacement_missing',
    'replacement_required',
    'replacement_not_found',
    'replacement_self',
    'replacement_not_active',
    'replacement_premade',
    'replacement_not_owned',
    'replacement_plan_gated',
    'replacement_not_call_eligible',
    'replacement_cycle',
    'replacement_mismatch',
    'voice_is_replacement',
    'min_plan_required',
    'unknown_plan',
    'visibility_requires_publish',
    'status_transition_not_allowed',
    'premade_admin_only',
])

export const PUBLISH_PRECONDITION_CODE = 'publish_precondition_failed'
/** 409 on a retire, plan gate or identity PATCH while other voices depend on this one (I-29). */
export const VOICE_IS_REPLACEMENT_CODE = 'voice_is_replacement'

export function parsePublishFailure(raw: string): PublishFailure {
    const separator = raw.indexOf(':')
    if (separator <= 0) return { code: raw, language: null }
    const language = raw.slice(separator + 1).trim()
    return { code: raw.slice(0, separator), language: language || null }
}

/**
 * The refusals an error carries: the `failed` list of a 422
 * `publish_precondition_failed`, or a single known refusal code. Null for any
 * other error (it is described by `describeConsoleError`).
 */
export function publishFailures(error: unknown): PublishFailure[] | null {
    if (!(error instanceof ApiError) || !error.code) return null
    if (error.code === PUBLISH_PRECONDITION_CODE) {
        const failed = error.details?.failed
        const items = Array.isArray(failed) ? failed.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '') : []
        return items.map((entry) => parsePublishFailure(entry.trim()))
    }
    if (!PUBLISH_FAILURE_CODES.has(error.code)) return null
    if (error.code === VOICE_IS_REPLACEMENT_CODE) {
        const keys = error.details?.dependent_voice_keys
        const dependents = Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string' && key.trim() !== '') : []
        if (dependents.length > 0) return [{ code: error.code, language: null, dependentVoiceKeys: dependents }]
    }
    return [{ code: error.code, language: null }]
}

/** Localized copy for one refusal; an unknown code is shown as itself, never dropped. */
export function publishFailureMessage(failure: PublishFailure, t: TFunction, languageName: (code: string) => string = (code) => code): string {
    if (!PUBLISH_FAILURE_CODES.has(failure.code)) return t('admin.voices.publishFailures.unknown', { code: failure.code })
    const language = failure.language ? languageName(failure.language) : t('admin.voices.publishFailures.someLanguage')
    return t(`admin.voices.publishFailures.${failure.code}`, LANGUAGE_CODES.has(failure.code) ? { language } : undefined)
}
