/**
 * Display name for a stored voice (09 §3.1, 05 §7.6). Order: the read-only
 * `effective_voice.display_name` (D35, from R1), then the V2 `voice_name`
 * display cache, then the copied `preset_name`. It never falls back to a raw
 * provider or legacy V1 id: `null` means "no name to show" and callers render
 * their own translated fallback.
 */
import type { EffectiveVoice, StoredCharacterVoice } from '@/shared/types'
import { isVoiceV2 } from '@/shared/types'
import { parseStoredVoice } from './parseStoredVoice'

const nonEmpty = (value: string | null | undefined): string | null => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed || null
}

export function voiceDisplayName(
    stored: StoredCharacterVoice | null | undefined,
    effective?: EffectiveVoice | null,
): string | null {
    const voice = parseStoredVoice(stored)
    if (!voice) return null
    return nonEmpty(effective?.display_name)
        ?? (isVoiceV2(voice) ? nonEmpty(voice.voice_name) : null)
        ?? nonEmpty(voice.preset_name)
}
