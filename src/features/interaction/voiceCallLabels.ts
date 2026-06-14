/**
 * Shared status labels + error copy for the voice-call UI (CallScreen and any legacy
 * composer). Kept separate so the call surface can be redesigned without duplicating the
 * VoiceCallState → human-text mapping.
 */
import type { TFunction } from 'i18next'
import type { VoiceCallState } from '@/shared/types/voice.types'
import type { VoiceCallControllerError } from './hooks/useVoiceCallController'

/** States where the call is live (mic engaged / a turn in flight). */
export const ACTIVE_CALL_STATES = new Set<VoiceCallState>([
    'requesting_permission',
    'connecting',
    'reconnecting',
    'listening',
    'user_speaking',
    'uploading_segment',
    'transcribing',
    'assistant_thinking',
    'assistant_speaking',
    'barge_in',
])

/** i18n key per voice-call state, resolved against the `interaction` namespace at render. */
const CALL_STATE_LABEL_KEY: Record<VoiceCallState, string> = {
    disabled: 'interaction.callState.disabled',
    idle: 'interaction.callState.idle',
    consent_required: 'interaction.callState.consentRequired',
    requesting_permission: 'interaction.callState.requestingPermission',
    connecting: 'interaction.callState.connecting',
    reconnecting: 'interaction.callState.reconnecting',
    listening: 'interaction.callState.listening',
    user_speaking: 'interaction.callState.userSpeaking',
    uploading_segment: 'interaction.callState.uploadingSegment',
    transcribing: 'interaction.callState.transcribing',
    assistant_thinking: 'interaction.callState.assistantThinking',
    assistant_speaking: 'interaction.callState.assistantSpeaking',
    barge_in: 'interaction.callState.bargeIn',
    ending: 'interaction.callState.ending',
    ended: 'interaction.callState.ended',
    error: 'interaction.callState.error',
}

export function callStateLabel(t: TFunction, state: VoiceCallState): string {
    return t(CALL_STATE_LABEL_KEY[state])
}

export function formatElapsed(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(safe / 60)
    const remainder = safe % 60
    return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function callErrorCopy(t: TFunction, error?: VoiceCallControllerError | null, state?: VoiceCallState): string | null {
    if (state === 'disabled') return t('interaction.callError.disabledEnv')
    if (!error) return null
    switch (error.category) {
        case 'permission_denied':
            return t('interaction.callError.permissionDenied')
        case 'quota_exceeded':
            return error.retryAfterSeconds
                ? t('interaction.callError.quotaRetry', { minutes: Math.ceil(error.retryAfterSeconds / 60) })
                : t('interaction.callError.quotaLater')
        case 'disabled':
            return t('interaction.callError.disabledBackend')
        case 'consent_required':
        case 'consent_stale':
            return t('interaction.callError.consentReview')
        case 'provider_submission':
        case 'stt_failed':
        case 'tts_unavailable':
            return t('interaction.callError.providerFailed')
        default:
            return error.message || t('interaction.callError.generic')
    }
}
