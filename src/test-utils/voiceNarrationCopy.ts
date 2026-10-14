/**
 * Test helper: loads the block-H narration and call copy (`voices.refresh.*`,
 * `voices.sessionTier.*`, `voices.call.*`) into the shared i18n store until the
 * locale owner spreads `voiceNarration.ts` into en.ts and es.ts. Deep-merged
 * without overwrite, so once the spread lands this is a no-op.
 */
import { i18n } from '@/app/i18n'
import {
    voiceCallNoteEn,
    voiceCallNoteEs,
    voiceRefreshEn,
    voiceRefreshEs,
    voiceSessionTierEn,
    voiceSessionTierEs,
} from '@/app/i18n/locales/voiceNarration'

export function installVoiceNarrationCopy(): void {
    i18n.addResourceBundle('en', 'translation', { voices: { refresh: voiceRefreshEn, sessionTier: voiceSessionTierEn, call: voiceCallNoteEn } }, true, false)
    i18n.addResourceBundle('es', 'translation', { voices: { refresh: voiceRefreshEs, sessionTier: voiceSessionTierEs, call: voiceCallNoteEs } }, true, false)
}
