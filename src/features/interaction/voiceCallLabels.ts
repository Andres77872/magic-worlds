/**
 * Shared status labels + error copy for the voice-call UI (CallScreen and any legacy
 * composer). Kept separate so the call surface can be redesigned without duplicating the
 * VoiceCallState → human-text mapping.
 */
import type { TFunction } from 'i18next'
import type { VoiceCallState, VoiceEndReason } from '@/shared/types/voice.types'
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

/**
 * Client code for a call start refused up front because the server reports calls
 * switched off for this account (`capabilities.status.calls_available: false`,
 * 09 §7). No redial is offered while it holds.
 */
export const CALLS_UNAVAILABLE_CODE = 'CALLS_UNAVAILABLE'

/** i18n key for a controller-originated error code (client-side failures). */
const CALL_ERROR_CODE_KEY: Record<string, string> = {
    VOICE_READY_TIMEOUT: 'interaction.callError.readyTimeout',
    VOICE_CONNECTION_LOST: 'interaction.callError.connectionLost',
    VOICE_TURN_FAILED: 'interaction.callError.turnFailed',
    VOICE_UPLOAD_FAILED: 'interaction.callError.uploadFailed',
    VOICE_NO_INPUT: 'interaction.callError.noInput',
    VOICE_DEVICE_LOST: 'interaction.callError.deviceLost',
    [CALLS_UNAVAILABLE_CODE]: 'interaction.callError.callsUnavailable',
    // Workspace R1: the socket's `voice_error` (or an HTTP error) names the workspace code.
    WORKSPACE_ARCHIVED: 'workspaceActivity.call.workspaceArchived',
    WORKSPACE_NOT_FOUND: 'workspaceActivity.call.workspaceUnavailable',
    WORKSPACE_SELECTOR_MISMATCH: 'workspaceActivity.call.workspaceUnavailable',
    WORKSPACE_REQUIRED: 'workspaceActivity.call.stale',
    WORKSPACE_ACTIVE_CALL: 'workspaceUi.errors.activeCall',
    // The socket's 4404 close: the chat is missing or belongs to another workspace.
    CHAT_SESSION_NOT_FOUND: 'workspaceActivity.chat.sessionUnavailable',
    // Voice gates (D26, D37; 09 §2.2): attestation, token bucket, Free prerequisites, spent budget.
    attestation_required: 'attestation.callRequired',
    rate_limited: 'voices.errors.rateLimited',
    voice_not_eligible: 'voices.errors.freeNotEligible',
    narration_paused: 'voices.errors.budgetUnavailable',
    // `voice_error{category:"tts_unavailable", code}` (03 §5.8, 08 §5.8; 09 §4.6): the code
    // picks the copy so these never read as the generic provider failure.
    voice_unavailable: 'interaction.callError.voiceUnavailable',
    moderation_unavailable: 'interaction.callError.moderationUnavailable',
    // R2 safeguards (PC-1, PC-2): a self-harm safety pause, and the `all_voice` geo block.
    voice_safety_pause: 'voices.errors.safetyPause',
    voice_region_unavailable: 'voices.errors.regionUnavailable',
}

/** Workspace R1 codes no redial can fix from the call screen. */
export function isWorkspaceCallError(code: string | undefined | null): boolean {
    return Boolean(code && (code.startsWith('WORKSPACE_') || code === 'CHAT_SESSION_NOT_FOUND'))
}

/** Voice refusals a redial cannot fix: the pause or the region block holds whatever the client does. */
const TERMINAL_VOICE_CALL_CODES: ReadonlySet<string> = new Set(['voice_safety_pause', 'voice_region_unavailable'])

/** True for a call error that ends voice for now (no redial): the safety pause and the region block. */
export function isTerminalVoiceCallError(code: string | undefined | null): boolean {
    return Boolean(code && TERMINAL_VOICE_CALL_CODES.has(code))
}

/**
 * Localized copy for a call error. Never shows raw server/protocol strings
 * (`no_speech`, `call_not_active`, English provider messages): the code or the
 * category picks the copy, with a generic fallback.
 */
export function callErrorCopy(t: TFunction, error?: VoiceCallControllerError | null, state?: VoiceCallState): string | null {
    if (state === 'disabled') return t('interaction.callError.disabledEnv')
    if (!error) return null
    const codeKey = error.code ? CALL_ERROR_CODE_KEY[error.code] : undefined
    if (codeKey) return t(codeKey)
    if (error.code?.startsWith('VOICE_SEGMENT_')) return t('interaction.callError.segmentRejected')
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
        case 'auth':
            return t('interaction.callError.auth')
        case 'not_found':
            return t('interaction.callError.notFound')
        case 'busy':
        case 'conflict':
        case 'stt_rate_limited':
            return t('interaction.callError.busy')
        case 'stt_timeout':
        case 'llm_timeout':
        case 'tts_timeout':
            return t('interaction.callError.timeout')
        case 'unsupported_media':
            return t('interaction.callError.unsupported')
        case 'provider_submission':
        case 'stt_failed':
        case 'tts_unavailable':
        case 'tts_stream_interrupted':
        case 'upstream_contract':
            return t('interaction.callError.providerFailed')
        default:
            return t('interaction.callError.generic')
    }
}

const END_REASON_KEY: Record<VoiceEndReason, string> = {
    user: 'call.screen.endReason.user',
    quota: 'call.screen.endReason.quota',
    superseded: 'call.screen.endReason.superseded',
    disconnected: 'call.screen.endReason.disconnected',
    idle_timeout: 'call.screen.endReason.idleTimeout',
    max_duration: 'call.screen.endReason.maxDuration',
    server_shutdown: 'call.screen.endReason.serverShutdown',
    // WS-S5: an operator restriction or a safety pause ended the call.
    voice_restricted: 'voices.errors.callRestricted',
}

/** Copy explaining why a call ended; unknown reasons read as a plain "call ended". */
export function endReasonCopy(t: TFunction, reason?: VoiceEndReason | string | null): string {
    const key = reason && reason in END_REASON_KEY ? END_REASON_KEY[reason as VoiceEndReason] : END_REASON_KEY.user
    return t(key)
}
