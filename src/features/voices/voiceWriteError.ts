/**
 * Voice write refusals as copy (I-36). A refused voice write (card, draft,
 * template, preset) answers a coded 422/409; the API client keeps the code on
 * `error.code` (or, for a bare `{detail: {code}}`, on `error.details.code`).
 * Known codes map through `voiceWriteErrorKey`; anything else returns null and
 * the caller keeps its own fallback.
 */
import type { TFunction } from 'i18next'
import { voiceWriteErrorKey } from '@/shared/voice/voiceWriteErrors'

/** The refusal code of a failed write, or null. */
export function voiceWriteErrorCode(error: unknown): string | null {
    const failure = error as { code?: unknown; details?: unknown } | null
    if (typeof failure?.code === 'string' && failure.code.trim()) return failure.code
    const details = failure?.details
    if (details && typeof details === 'object' && !Array.isArray(details)) {
        const code = (details as { code?: unknown }).code
        if (typeof code === 'string' && code.trim()) return code
    }
    return null
}

/** The translated refusal for a voice write error, or null when it is not one. */
export function voiceWriteErrorMessage(error: unknown, t: TFunction): string | null {
    const code = voiceWriteErrorCode(error)
    const key = code ? voiceWriteErrorKey(code) : null
    return key ? t(key) : null
}
