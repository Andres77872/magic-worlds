/**
 * The language a character card is known to speak, as far as its stored voice
 * says (05 §7.1, D17 step 2): the voice's `language_code`. Null when the card
 * says nothing. Cards carry no language field of their own.
 */
import type { StoredCharacterVoice } from '@/shared/types'

/** Base ISO 639 code of a language tag (`es-MX` → `es`), or null when it is not one. */
function baseCode(value: string | null | undefined): string | null {
    const code = (value ?? '').trim().toLowerCase().split(/[-_]/)[0]
    return /^[a-z]{2,3}$/.test(code) ? code : null
}

export function storedVoiceLanguage(voice: StoredCharacterVoice | null | undefined): string | null {
    return voice ? baseCode(voice.language_code) : null
}
