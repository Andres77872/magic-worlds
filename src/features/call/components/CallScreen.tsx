/**
 * CallScreen — the immersive, hands-free voice-call surface.
 *
 * Split into two pieces:
 *   - `CallScreen` (container): owns `useVoiceCallController` + the consent gate, and
 *     wires them to the view. This is what the app mounts.
 *   - `CallScreenView` (pure): the immersive layout — a large character portrait that
 *     pulses while listening / glows while the character speaks, a big status line + timer,
 *     a live waveform driven by the mic level, live captions, and large Mute / End /
 *     Interrupt controls. Once the call ends it explains why (quota, silence, max
 *     length, connection) and offers to call again. It takes plain props, so stories +
 *     unit tests drive it directly without a socket. Turn-taking is automatic (VAD) — there is no push-to-talk.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Bot, Headphones, Loader2, MessageSquareText, Mic, MicOff, Phone, PhoneOff, Volume2, Waves, X } from 'lucide-react'
import { useAuth, useData } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { Character } from '@/shared'
import type { VoiceCallState, VoiceEndReason } from '@/shared/types/voice.types'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { Avatar, Badge, Button, GlowBackdrop, Icon, IconButton, cx } from '@/ui/primitives'
import { useVoiceCallController, type VoiceCallControllerError } from '@/features/interaction/hooks/useVoiceCallController'
import { useVoiceAvailability } from '@/features/interaction/hooks/useVoiceAvailability'
import { useVoiceCapabilitiesSnapshot } from '@/features/interaction/hooks/useVoiceCapabilitiesSnapshot'
import { BreakNudge, CrisisResourcesPanel } from '@/features/safety'
import { readSafeguards } from '@/shared/voice/voiceCapabilities'
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'
import { VoiceConsentModal } from '@/features/interaction/components/VoiceConsentModal'
import { useSessionWorkspace } from '@/features/interaction/hooks/useSessionWorkspace'
import { useVoiceRefresh } from '@/features/interaction/hooks/useVoiceRefresh'
import { callVoiceNote, type CallVoiceNote as CallVoiceNoteValue } from '../callVoiceNote'
import { CallVoiceNote } from './CallVoiceNote'
import {
    ACTIVE_CALL_STATES,
    CALLS_UNAVAILABLE_CODE,
    callStateLabel,
    callErrorCopy,
    endReasonCopy,
    formatElapsed,
    isTerminalVoiceCallError,
    isWorkspaceCallError,
} from '@/features/interaction/voiceCallLabels'
import { CallWaveform } from './CallWaveform'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'

interface CallScreenProps {
    character?: Character
    sessionId: number
    /** Workspace R1: the chat's own workspace (`chat.organization.workspace_id`), when known. */
    workspaceId?: string | null
    ensureSession?: () => Promise<number>
    /** Leave the call and return to the text chat. */
    onSwitchToText: () => void
}

export function CallScreen({ character, sessionId, workspaceId, ensureSession, onSwitchToText }: CallScreenProps) {
    const { t } = useTranslation()
    const { isAuthenticated, token } = useAuth()
    const voiceEnabled = isFrontendVoiceModeEnabled()
    const [consentOpen, setConsentOpen] = useState(true)
    const [isAccepting, setIsAccepting] = useState(false)

    const controller = useVoiceCallController({
        sessionId: voiceEnabled && isAuthenticated && token && !Number.isNaN(sessionId) ? sessionId : null,
        workspaceId,
        ensureSession,
        authKey: token ?? null,
        consentGranted: true,
        enabled: voiceEnabled,
        // VAD turn-taking tuning. Add `speechThreshold` here (0..1 RMS) to override the
        // worklet default if mics under-/over-trigger; lower = more sensitive.
        // 550 ms of silence ends a turn (fixed-silence voice agents use 400-550 ms). A pause
        // that was only a breath still works: the server supersedes the cut turn and merges
        // its text with the continuation while that turn is not yet admitted.
        vad: { silenceMsToEnd: 550, minSpeechMs: 250 },
    })

    const name = character?.name?.trim() || t('call.screen.fallbackName')

    // 09 §7: the server reports calls switched off for this account (`capabilities.status`,
    // fail open).
    const availability = useVoiceAvailability(apiService, voiceEnabled && isAuthenticated)

    // Consent copy (D25): always the voice-v2 copy, the version the BFF records and
    // requires (I-68), so the consent needs no version read and is never pending.
    // A `consent_stale` refusal (a stored older consent) reopens the consent in its review state.
    // Adjusted during render (no effect): each new refusal opens the consent once.
    const consentStaleError = controller.error?.category === 'consent_stale' ? controller.error : null
    const [seenConsentStale, setSeenConsentStale] = useState<typeof consentStaleError>(null)
    if (consentStaleError !== seenConsentStale) {
        setSeenConsentStale(consentStaleError)
        if (consentStaleError) setConsentOpen(true)
    }

    // R1-FE-05 voice note: a call voice or a replaced voice.
    const voiceNote = callVoiceNote(controller.effectiveVoice, controller.originalVoiceName, controller.substitutionReason, controller.replacedVoiceName)
    const { api: sessionApi } = useSessionWorkspace(workspaceId)
    const { refreshCharacterChatVoice } = useData()

    // Workspace R1: a chat in an archived workspace cannot take a call. Say so
    // before the socket opens instead of waiting for the server's refusal; a
    // call already running is left alone.
    const readOnly = useWorkspaceReadOnly(workspaceId)
    const idle = !ACTIVE_CALL_STATES.has(controller.state) && controller.state !== 'ending'
    // 09 §7: calls switched off for this account. Say so before the socket opens; a call
    // already running continues.
    const callsAvailable = availability.calls_available
    // Companion safeguards (EP-11): every capabilities read carries them; all off on a failed read.
    const voiceCapabilities = useVoiceCapabilitiesSnapshot(apiService, voiceEnabled && isAuthenticated)
    const startBlocked: VoiceCallControllerError | null = readOnly && idle
        ? { category: 'conflict', code: 'WORKSPACE_ARCHIVED', message: 'This workspace is archived.', fatal: true }
        : !callsAvailable && idle
          ? { category: 'disabled', code: CALLS_UNAVAILABLE_CODE, message: 'Voice calls are unavailable.', fatal: true }
          : null
    // "Use the card's current voice" on the end panel: a replaced voice, a writable chat.
    // Goes through the data layer (on the chat's workspace client) so the stored chat
    // and its effective voice are current when the user goes back to text.
    const refreshVoice = voiceNote?.kind === 'replaced' && !readOnly && sessionApi && Number.isInteger(sessionId) && sessionId > 0
        ? () => refreshCharacterChatVoice(String(sessionId), sessionApi)
        : undefined

    // Runs from the click itself: startCall unlocks audio playback synchronously
    // before its first await (iOS only allows that inside a user gesture).
    const acceptConsent = async () => {
        if (isAccepting || startBlocked) return
        setIsAccepting(true)
        try {
            const started = await controller.startCall()
            if (started) setConsentOpen(false)
        } finally {
            setIsAccepting(false)
        }
    }

    const leave = () => {
        void controller.endCall()
        onSwitchToText()
    }

    return (
        <CallScreenView
            profileControl={<LlmFeatureControl feature="callbot" />}
            name={name}
            imageUrl={character?.image_url ?? null}
            state={startBlocked ? 'error' : controller.state}
            isMuted={controller.isMuted}
            elapsedSeconds={controller.elapsedSeconds}
            remainingSeconds={controller.remainingSeconds}
            inputLevel={controller.inputLevel}
            transcript={controller.transcript}
            assistantText={controller.assistantText}
            error={startBlocked ?? controller.error}
            endReason={controller.endReason}
            autoplayBlocked={controller.autoplayBlocked}
            echoCancellationOff={controller.echoCancellationOff}
            consentOpen={consentOpen && !startBlocked}
            isAccepting={isAccepting}
            onAcceptConsent={acceptConsent}
            onCallAgain={acceptConsent}
            onResumePlayback={() => void controller.resumePlayback()}
            onDismissError={controller.dismissError}
            onDeclineConsent={() => {
                setConsentOpen(false)
                onSwitchToText()
            }}
            onMute={controller.mute}
            onUnmute={controller.unmute}
            onBargeIn={() => controller.bargeIn()}
            onEnd={leave}
            onSwitchToText={leave}
            breakNudgeMinutes={readSafeguards(voiceCapabilities).break_nudge_minutes}
            voiceNote={voiceNote}
            onRefreshVoice={refreshVoice}
            audioUnsupported={controller.audioUnsupported}
        />
    )
}

export interface CallScreenViewProps {
    profileControl?: ReactNode
    name: string
    imageUrl?: string | null
    state: VoiceCallState
    isMuted: boolean
    elapsedSeconds: number
    /** Seconds left before the call's max length; a warning shows in the last minute. */
    remainingSeconds?: number | null
    /** Live mic level 0..1 for the reactive waveform. */
    inputLevel: number
    transcript?: string | null
    assistantText?: string
    error?: VoiceCallControllerError | null
    /** Why the call ended, shown on the end panel. */
    endReason?: VoiceEndReason | null
    /** The browser blocked autoplay of the character's voice. */
    autoplayBlocked?: boolean
    /** Echo cancellation is off: voice barge-in is disabled, suggest headphones. */
    echoCancellationOff?: boolean
    consentOpen: boolean
    isAccepting: boolean
    onAcceptConsent: () => void
    onCallAgain?: () => void
    onResumePlayback?: () => void
    onDismissError?: () => void
    onDeclineConsent: () => void
    onMute: () => void
    onUnmute: () => void
    onBargeIn: () => void
    onEnd: () => void
    onSwitchToText: () => void
    /** Companion break reminder interval (`readSafeguards(capabilities).break_nudge_minutes`); null: never. */
    breakNudgeMinutes?: number | null
    /** R1: the call speaks with a call voice or a replaced voice. */
    voiceNote?: CallVoiceNoteValue | null
    /** R1: refresh the chat's voice from the card (offered on the end panel for a replaced voice). */
    onRefreshVoice?: () => Promise<unknown>
    /** R1: the current reply's audio could not play; it shows as text. */
    audioUnsupported?: boolean
}

export function CallScreenView({
    profileControl,
    name,
    imageUrl,
    state,
    isMuted,
    elapsedSeconds,
    remainingSeconds = null,
    inputLevel,
    transcript,
    assistantText,
    error,
    endReason = null,
    autoplayBlocked = false,
    echoCancellationOff = false,
    consentOpen,
    isAccepting,
    onAcceptConsent,
    onCallAgain,
    onResumePlayback,
    onDismissError,
    onDeclineConsent,
    onMute,
    onUnmute,
    onBargeIn,
    onEnd,
    onSwitchToText,
    breakNudgeMinutes = null,
    voiceNote = null,
    onRefreshVoice,
    audioUnsupported = false,
}: CallScreenViewProps) {
    const { t } = useTranslation()
    const isActive = ACTIVE_CALL_STATES.has(state)
    const isAssistant = state === 'assistant_speaking' || state === 'assistant_thinking'
    const isSpeaking = state === 'assistant_speaking'
    const isUserTurn = state === 'listening' || state === 'user_speaking'
    const isConnecting = state === 'connecting' || state === 'reconnecting' || state === 'requesting_permission'
    // A fatal error or a server/user end leaves the call over: explain why and offer a redial.
    const isOver = !consentOpen && (state === 'ended' || state === 'error')
    const visibleError = callErrorCopy(t, error, state)
    const endCopy = state === 'ended' ? endReasonCopy(t, endReason) : visibleError
    // Workspace R1: an archived, removed or stale workspace (or a chat no longer in it) cannot take a redial;
    // nor can a call start the server reports switched off (09 §7). A safety pause or region block
    // (ended or errored) and a voice_restricted end are not lifted by redialing (R1/R2 only, never on R0).
    const canRedial = !(state === 'error' && (isWorkspaceCallError(error?.code) || error?.code === CALLS_UNAVAILABLE_CODE))
        && !isTerminalVoiceCallError(error?.code)
        && endReason !== 'voice_restricted'
    const showTimeLeft = isActive && remainingSeconds !== null && remainingSeconds <= 60

    const avatarRing = isAssistant ? 'arcane' : 'ember'
    const avatarStatus = state === 'assistant_thinking' ? 'think' : isUserTurn ? 'live' : 'none'
    const glowClass = isSpeaking
        ? 'shadow-glow-arcane scale-[1.04]'
        : state === 'user_speaking'
          ? 'shadow-glow-ember scale-[1.03]'
          : isConnecting
            ? 'opacity-80'
            : ''

    const waveTone = isAssistant ? 'arcane' : isUserTurn ? 'ember' : 'idle'
    const statusLabel = consentOpen && !isActive ? t('call.screen.calling', { name }) : callStateLabel(t, state)
    // R1-FE-05: captions never show speech markup (`<#0.5#>`, `(laughs)`); they may end mid-token while the reply streams.
    const captionText = assistantText ? stripSpeechMarkupV1(assistantText, { partial: true }) : assistantText

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-900 text-parchment-50" data-testid="call-screen">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <GlowBackdrop variant="center" />
            </div>

            {/* Top: leave / switch to text */}
            <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3">
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={MessageSquareText} size={15} />} onClick={onSwitchToText}>
                    {t('call.screen.switchToText')}
                </Button>
                {isActive && (
                    <span className="flex items-center gap-2 font-mono text-sm text-parchment-300">
                        {showTimeLeft && (
                            <span className="text-amber-500" role="status">
                                {t('call.screen.timeLeft', { time: formatElapsed(remainingSeconds ?? 0) })}
                            </span>
                        )}
                        {formatElapsed(elapsedSeconds)}
                    </span>
                )}
            </div>

            {profileControl && <div className="relative z-10 px-4 pb-3">{profileControl}</div>}
            {/* Center: identity + status + waveform + captions */}
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 text-center">
                <div className="flex min-h-full flex-col items-center justify-center gap-5 py-5">
                <div className={cx('rounded-full transition-all duration-300 ease-out', glowClass)}>
                    <Avatar name={name} src={imageUrl ?? null} size={188} ring={avatarRing} status={avatarStatus} />
                </div>

                <div className="flex flex-col items-center gap-1">
                    <h1 className="font-display text-h2 font-semibold leading-tight text-parchment-50">{name}</h1>
                    {/* D26 item 7: the call header always says the voice is AI-generated. */}
                    <Badge tone="arcane" icon={<Icon icon={Bot} size={12} />} data-testid="call-ai-voice">
                        {t('call.screen.aiVoice')}
                    </Badge>
                    {voiceNote && <CallVoiceNote note={voiceNote} />}
                    <p className={cx('font-ui text-sm font-semibold tracking-wide', isAssistant ? 'text-arcane-300' : isUserTurn ? 'text-ember-300' : 'text-parchment-300')}>
                        {isConnecting && <Icon icon={Loader2} size={13} className="mr-1 inline animate-spin" />}
                        {isSpeaking && <Icon icon={Volume2} size={13} className="mr-1 inline" />}
                        {statusLabel}
                    </p>
                </div>

                <CallWaveform level={inputLevel} tone={waveTone} animated={isSpeaking} className="w-full max-w-[320px]" />

                {/* Live captions */}
                <div className="flex min-h-[3.5rem] w-full max-w-[560px] flex-col gap-2 text-[15px] leading-relaxed">
                    {captionText && (
                        <p className="border-l-2 border-arcane-500/40 py-2 pl-4 text-left text-parchment-100">
                            <span className="font-semibold text-arcane-300">{name}:</span> {captionText}
                        </p>
                    )}
                    {transcript && (
                        <p className="border-l-2 border-ember-500/40 py-2 pl-4 text-left text-parchment-100">
                            <span className="font-semibold text-ember-300">{t('call.screen.youLabel')}</span> {transcript}
                        </p>
                    )}
                </div>

                {audioUnsupported && isActive && (
                    <p role="status" className="max-w-[560px] text-caption text-parchment-300" data-testid="call-audio-unsupported">
                        {t('voices.call.audioUnsupported')}
                    </p>
                )}

                {echoCancellationOff && isActive && (
                    <p className="flex max-w-[560px] items-start gap-2 rounded-lg border border-ember-500/30 bg-ember-500/10 px-3 py-1.5 text-left text-caption text-ember-200">
                        <Icon icon={Headphones} size={14} className="mt-0.5 shrink-0" />
                        <span>{t('call.screen.headphonesHint')}</span>
                    </p>
                )}
                </div>
            </div>

            {/* Prompts and notices sit above the controls so they never scroll out of view */}
            {autoplayBlocked && isActive && onResumePlayback && (
                <div className="relative z-10 flex shrink-0 justify-center px-6 pt-2">
                    <Button variant="arcane" size="sm" iconLeft={<Icon icon={Volume2} size={15} />} onClick={onResumePlayback}>
                        {t('call.screen.tapToListen', { name })}
                    </Button>
                </div>
            )}
            {!isOver && visibleError && (
                <div className="relative z-10 flex shrink-0 justify-center px-6 pt-2">
                    <div role="alert" className="flex w-full min-w-0 max-w-[560px] items-start gap-2 rounded-lg border border-blood-500/30 bg-blood-500/10 px-3 py-2 text-left text-sm text-blood-500">
                        <Icon icon={AlertTriangle} size={16} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                            {visibleError}
                            {error?.code && <span className="ml-1 break-all font-mono text-caption opacity-70">({error.code})</span>}
                        </span>
                        {onDismissError && !error?.fatal && (
                            <IconButton label={t('call.screen.dismiss')} size="sm" onClick={onDismissError}>
                                <Icon icon={X} size={14} />
                            </IconButton>
                        )}
                    </div>
                </div>
            )}

            {/* R2-BE-01 (ER-H1): a self-harm safety pause ended the call; only approved generic lines show. */}
            {error?.code === 'voice_safety_pause' && (
                <div className="relative z-10 flex shrink-0 justify-center px-6 pt-2" data-testid="call-safety-pause">
                    <CrisisResourcesPanel
                        retryAfterSeconds={error.retryAfterSeconds ?? null}
                        className="flex w-full min-w-0 max-w-[560px] flex-col gap-1 rounded-lg border border-parchment-50/10 bg-ink-800/80 px-3 py-2 text-left"
                    />
                </div>
            )}
            <BreakNudge minutes={breakNudgeMinutes} active={isActive} className="relative z-10 mx-auto mt-2 w-[calc(100%-3rem)] max-w-[560px] shrink-0" />

            {/* Bottom: the end-of-call panel replaces the controls, so its actions never scroll away */}
            {isOver ? (
                <div className="relative z-10 flex shrink-0 justify-center px-6 pb-3 pt-3">
                    <div role="status" className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-xl border border-parchment-50/10 bg-ink-800/80 px-5 py-4">
                        <p className="font-display text-h3 font-semibold text-parchment-50">{t('call.screen.endedTitle')}</p>
                        {endCopy && <p className="text-sm text-parchment-200">{endCopy}</p>}
                        {state === 'error' && error?.code && <p className="break-all font-mono text-caption text-parchment-400">{error.code}</p>}
                        {voiceNote?.kind === 'replaced' && onRefreshVoice && <CallVoiceRefresh onRefresh={onRefreshVoice} />}
                        {voiceNote?.kind === 'call_voice' && (
                            <p className="text-sm text-parchment-300" data-testid="call-pick-call-ready">{t('voices.call.pickCallReady')}</p>
                        )}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {onCallAgain && canRedial && (
                                <Button variant="primary" size="sm" iconLeft={<Icon icon={Phone} size={15} />} onClick={onCallAgain} disabled={isAccepting}>
                                    {t('call.screen.callAgain')}
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" iconLeft={<Icon icon={MessageSquareText} size={15} />} onClick={onSwitchToText}>
                                {t('call.screen.backToChat')}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative z-10 flex shrink-0 items-center justify-center gap-4 px-6 pb-5 pt-3">
                    <CallControlButton
                        label={isMuted ? t('call.screen.unmute') : t('call.screen.mute')}
                        tone={isMuted ? 'danger' : 'neutral'}
                        onClick={() => (isMuted ? onUnmute() : onMute())}
                        disabled={!isActive}
                        icon={isMuted ? MicOff : Mic}
                    />
                    {isSpeaking && (
                        <CallControlButton label={t('call.screen.interrupt')} tone="arcane" onClick={onBargeIn} icon={Waves} />
                    )}
                    <CallControlButton label={t('call.screen.endCall')} tone="danger" prominent onClick={onEnd} icon={PhoneOff} />
                </div>
            )}

            <p className="relative z-10 shrink-0 px-6 pb-4 text-center text-caption text-parchment-400">
                {t('call.screen.privacyNote')}
            </p>

            <VoiceConsentModal
                open={consentOpen}
                staleConsent={error?.category === 'consent_stale'}
                isAccepting={isAccepting}
                onAccept={onAcceptConsent}
                onDecline={onDeclineConsent}
            />
        </div>
    )
}

/** End-panel "Use the card’s current voice": the new voice applies from the next call. */
function CallVoiceRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
    const { t } = useTranslation()
    const refresh = useVoiceRefresh()
    const message = refresh.status === 'done' ? t('voices.refresh.appliesNextCall') : refresh.message
    return (
        <div className="flex flex-col items-center gap-1.5" data-testid="call-voice-refresh">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => void refresh.run(onRefresh)}
                disabled={refresh.status === 'busy' || refresh.status === 'done'}
            >
                {t('voices.refresh.action')}
            </Button>
            <p aria-live="polite" className={cx('text-caption', refresh.status === 'error' ? 'text-blood-300' : 'text-parchment-300')}>
                {message ?? t('voices.refresh.appliesNextCall')}
            </p>
        </div>
    )
}

function CallControlButton({
    label,
    icon,
    tone,
    prominent = false,
    disabled = false,
    onClick,
}: {
    label: string
    icon: typeof Mic
    tone: 'neutral' | 'danger' | 'arcane'
    prominent?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    const size = prominent ? 'h-16 w-16' : 'h-14 w-14'
    const toneClass =
        tone === 'danger'
            ? 'bg-blood-500/90 text-parchment-50 hover:bg-blood-500'
            : tone === 'arcane'
              ? 'bg-arcane-500/85 text-parchment-50 hover:bg-arcane-500'
              : 'bg-ink-700/80 text-parchment-100 hover:bg-ink-600 border border-parchment-50/10'
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className={cx(
                'inline-flex shrink-0 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 disabled:cursor-not-allowed disabled:opacity-40',
                size,
                toneClass,
            )}
        >
            <Icon icon={icon} size={prominent ? 26 : 22} />
        </button>
    )
}
