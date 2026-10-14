/**
 * Voice helpers (09 §3). Read stored voices only through these: the D35 grep
 * gate (`voiceIdGate.test.ts`) fails on any `voice_id` read.
 */
export { keepStoredVoice, parseStoredVoice } from './parseStoredVoice'
export { hasAssignedVoice, isSameVoice, voiceIdentity } from './voiceIdentity'
export { voiceDisplayName } from './voiceDisplay'
export { isElevenLabsProjection, isSubstitutionReason, isVoiceBadgeKey, readEffectiveVoice } from './effectiveVoice'
export { VOICE_PROJECTION_KEYS, stripVoiceProjections } from './stripVoiceProjections'
export { THOUGHT_GAIN, clipGainDb, clipVolume } from './clipVolume'
export {
    FAIL_OPEN_VOICE_STATUS,
    SAFEGUARDS_OFF,
    VOICE_CAPABILITIES_TTL_MS,
    cachedVoiceCapabilities,
    clearVoiceCapabilitiesCache,
    readSafeguards,
    surfaceCapabilitiesFor,
    toVoiceCapabilities,
} from './voiceCapabilities'
export {
    NO_VOICE_NOTES,
    REPLACED_REASONS,
    isCallVoiceReason,
    isReplacedReason,
    isStandardFallback,
    turnVoiceNotes,
    type ReplacedVoiceNote,
    type TurnVoiceNotes,
} from './substitution'
export { SPEECH_MARKUP_V1, stripSpeechMarkupV1, type StripSpeechMarkupOptions } from './speechMarkup'
export { voiceWriteErrorKey } from './voiceWriteErrors'
export {
    CATALOG_KEYS_PER_REQUEST,
    CATALOG_PAGE_LIMIT_MAX,
    catalogKeyBatches,
    catalogQueryString,
    toCatalogItems,
    toCatalogPage,
    toCatalogVoice,
} from './voiceCatalog'
