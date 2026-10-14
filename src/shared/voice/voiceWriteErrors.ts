/**
 * Copy keys for the voice write refusals (I-36): the 422/409 `detail.code`
 * a voice write (card, draft, template, preset, session tier, refresh) can
 * answer. Picker, Studio, session tier and refresh UIs share this one map, so
 * a code never reads as a generic failure in one place and specific in
 * another. Unknown codes return null and the caller keeps its own fallback.
 */
const VOICE_WRITE_ERROR_KEYS: Readonly<Record<string, string>> = Object.freeze({
    voice_v1_not_allowed: 'voices.errors.v1NotAllowed',
    voice_not_eligible: 'voices.picker.eligibilityError',
    voice_plan_locked: 'voices.errors.planLocked',
    voice_invalid: 'voices.errors.invalid',
    voice_reload_required: 'voices.errors.reloadRequired',
    voice_tier_unavailable: 'voices.errors.tierUnavailable',
})

/** The i18n key for a voice write refusal code, or null when the code is not one. */
export function voiceWriteErrorKey(code: string): string | null {
    return Object.prototype.hasOwnProperty.call(VOICE_WRITE_ERROR_KEYS, code) ? VOICE_WRITE_ERROR_KEYS[code] : null
}
