/**
 * "▶ Listen" on a D15 review notice (05 §7.8): plays the flagged record's voice
 * as its free catalog sample. A catalog audition is unmetered (D18) and only
 * reads, so it stays available where the record is read-only, such as an
 * archived app workspace (05 §7.9: "Listen and Dismiss only").
 *
 * The voice is the host's `voiceKey` when it already knows it (the Studio's
 * preset rows); otherwise the record's effective voice (`GET /voices/effective`,
 * D35), asked through the record's workspace client for document refs (the BFF
 * answers 422 without the selector). A template-cast flag has no effective
 * read, so it can be heard only with a host hint.
 *
 * The playback itself is `useVoiceSample`, whose `heard` names the voice and
 * the sample's language once resolved (05 §10 "Audio controls").
 */
import { useCallback } from 'react'
import { apiService } from '@/infrastructure/api'
import type { EffectiveVoiceRefType, VoiceReviewFlag } from '@/shared'
import { isElevenLabsProjection, readEffectiveVoice } from '@/shared/voice'
import { useVoiceSample } from './useVoiceSample'

const EFFECTIVE_REFS: Partial<Record<VoiceReviewFlag['ref_type'], EffectiveVoiceRefType>> = {
    preset: 'preset',
    card: 'card',
    card_draft: 'card_draft',
}

/** `$.voice` and `voice` name the same path (the BFF sends the bare form). */
function normalizePath(path: unknown): string {
    return typeof path === 'string' ? path.trim().replace(/^\$\.?/, '') : ''
}

/** Whether "Listen" can resolve a voice for this flag with the api at hand. */
export function canListenToFlag(flag: VoiceReviewFlag, voiceKey?: string | null): boolean {
    if (typeof apiService.getVoiceCatalogByKeys !== 'function' || typeof apiService.fetchProtectedMediaBlob !== 'function') return false
    if (voiceKey) return true
    return Boolean(EFFECTIVE_REFS[flag.ref_type]) && typeof apiService.getEffectiveVoice === 'function'
}

/** The catalog voice the flagged record plays now, or null. */
export async function resolveFlagVoiceKey(flag: VoiceReviewFlag): Promise<string | null> {
    const refType = EFFECTIVE_REFS[flag.ref_type]
    if (!refType) return null
    const workspaceId = refType === 'preset' ? null : flag.organization?.workspace_id ?? null
    const client = workspaceId && typeof apiService.withWorkspace === 'function' ? apiService.withWorkspace(workspaceId) : apiService
    const response = await client.getEffectiveVoice(refType, flag.ref_id)
    const entries = Array.isArray(response?.voices) ? response.voices : []
    const wanted = normalizePath(flag.json_path)
    const match = entries.find((entry) => normalizePath(entry?.json_path) === wanted) ?? (entries.length === 1 ? entries[0] : undefined)
    const projection = readEffectiveVoice(match?.effective_voice)
    return isElevenLabsProjection(projection) ? projection.voice_key : null
}

/** "Listen" for one flag: the host's voice, else the flagged record's effective voice. */
export function useReviewFlagSample(flag: VoiceReviewFlag, { voiceKey = null, language = null }: { voiceKey?: string | null; language?: string | null } = {}) {
    const resolveKey = useCallback(() => resolveFlagVoiceKey(flag), [flag])
    return useVoiceSample({ voiceKey, language, resolveKey, scope: String(flag.flag_id) })
}
