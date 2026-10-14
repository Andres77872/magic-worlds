/**
 * 05 §7.4: "Eligibility is re-checked on save (D32). A 422 shows an inline
 * error on the voice field." A save refused for the picked voice itself —
 * 422 `voice_not_eligible` ("This voice can’t be picked right now. Choose
 * another.") or `voice_plan_locked` — also shows on the voice field, not only
 * as the form's save error. Both codes answer a V2 pick only (I-27); a refused
 * V1 write (`voice_v1_not_allowed`, `voice_reload_required`) stays a form error.
 */
import { voiceWriteErrorKey } from '@/shared/voice/voiceWriteErrors'
import { voiceWriteErrorCode } from './voiceWriteError'

const FIELD_CODES: ReadonlySet<string> = new Set(['voice_not_eligible', 'voice_plan_locked'])

/** The i18n key to show on the voice field for a failed save, or null. */
export function voiceFieldErrorKey(error: unknown): string | null {
    if ((error as { status?: unknown } | null)?.status !== 422) return null
    const code = voiceWriteErrorCode(error)
    return code && FIELD_CODES.has(code) ? voiceWriteErrorKey(code) : null
}
