/**
 * The language a character card is known to speak, as far as its stored voice
 * says (05 §7.1, D17 step 2): a V2 voice's `language_code`, or the language a
 * stored V1 voice's `language_boost` names (the migration fills `language_code`
 * from it). Null when the card says nothing: `auto`, a missing boost, an
 * unknown name. Cards carry no language field of their own.
 */
import type { StoredCharacterVoice } from '@/shared/types'
import { isVoiceV2 } from '@/shared/types'

/** Stored V1 `language_boost` names of the curated languages (D34). */
const V1_BOOST_LANGUAGES: Readonly<Record<string, string>> = { English: 'en', Spanish: 'es' }

/** Base ISO 639 code of a language tag (`es-MX` → `es`), or null when it is not one. */
function baseCode(value: string | null | undefined): string | null {
    const code = (value ?? '').trim().toLowerCase().split(/[-_]/)[0]
    return /^[a-z]{2,3}$/.test(code) ? code : null
}

export function storedVoiceLanguage(voice: StoredCharacterVoice | null | undefined): string | null {
    if (!voice) return null
    if (isVoiceV2(voice)) return baseCode(voice.language_code)
    const boost = (voice.language_boost ?? '').trim()
    return V1_BOOST_LANGUAGES[boost] ?? null
}
