/**
 * MiniMax custom voice_id rule, mirrored client-side for live form feedback:
 * 8–256 chars, start with a letter, only letters/digits/-/_, never end with
 * - or _. The backend re-validates with the same rule.
 */
import type { TFunction } from 'i18next'

export interface VoiceIdValidation {
    ok: boolean
    reason?: string
}

export function validateVoiceId(value: string, t: TFunction): VoiceIdValidation {
    const id = value.trim()
    if (id.length === 0) return { ok: false, reason: t('admin.voices.voiceIdRules.required') }
    if (id.length < 8 || id.length > 256) return { ok: false, reason: t('admin.voices.voiceIdRules.length') }
    if (!/^[A-Za-z]/.test(id)) return { ok: false, reason: t('admin.voices.voiceIdRules.startLetter') }
    if (/[-_]$/.test(id)) return { ok: false, reason: t('admin.voices.voiceIdRules.endChar') }
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return { ok: false, reason: t('admin.voices.voiceIdRules.charset') }
    return { ok: true }
}
