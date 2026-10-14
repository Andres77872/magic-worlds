/**
 * The catalog entry of a card voice that is leaving (05 §7.8, §9.3): its
 * `disable_at` dates the `leaving` badge ("Leaving on {date}") and its
 * `replacement` feeds "Switch to {replacement}". One host lookup serves both,
 * so the badge and the owner prompts never read the same key twice.
 *
 * The catalog is read only for a projection badged `leaving` (never without
 * a projection).
 */
import { useMemo } from 'react'
import type { CatalogVoice, EffectiveVoice, StoredCharacterVoice } from '@/shared'
import { isElevenLabsProjection, isVoiceV2 } from '@/shared/voice'
import { useCatalogLookup } from './useCatalogLookup'

/** The catalog voice that is leaving: the stored V2 voice, else the one the projection plays. */
export function leavingVoiceKey(stored: StoredCharacterVoice | null | undefined, effective: EffectiveVoice | null | undefined): string | null {
    if (!isElevenLabsProjection(effective)) return null
    if (stored && isVoiceV2(stored)) return stored.voice_key
    return effective.voice_key || null
}

/** Whether the projection carries the `leaving` badge. */
export function isLeaving(effective: EffectiveVoice | null | undefined): boolean {
    return isElevenLabsProjection(effective) && effective.badges.includes('leaving')
}

/** The leaving voice's catalog entry, or null (not leaving, not looked up yet, or not in the catalog). */
export function useLeavingVoice(
    stored: StoredCharacterVoice | null | undefined,
    effective: EffectiveVoice | null | undefined,
    enabled = true,
): CatalogVoice | null {
    const leaving = enabled && isLeaving(effective)
    const key = leaving ? leavingVoiceKey(stored, effective) : null
    const keys = useMemo(() => (key ? [key] : []), [key])
    const lookup = useCatalogLookup(keys, Boolean(key))
    return key ? lookup.get(key) ?? null : null
}
