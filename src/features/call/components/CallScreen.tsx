import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
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
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Bot, Headphones, Loader2, MessageSquareText, Mic, MicOff, Phone, PhoneOff, ScrollText, Settings2, Volume2, Waves, X } from 'lucide-react'
import { useAuth, useData } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { Character, StoredCharacterVoice } from '@/shared'
import { parseStoredVoice } from '@/shared/voice'
import type { VoiceCallState, VoiceEndReason } from '@/shared/types/voice.types'
import { isCallsFeatureEnabled } from '@/shared/featureFlags'
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
    isSetupCallError,
    isTerminalVoiceCallError,
    isWorkspaceCallError,
} from '@/features/interaction/voiceCallLabels'
import { CallWaveform } from './CallWaveform'
import { CallLiveTranscript } from './CallLiveTranscript'
import { lineDisplayText, type LiveTranscriptLine } from '../liveTranscript'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { readCallVoicePick, saveCallVoicePick } from '../callVoicePick'
import { CallSetup } from './CallSetup'
import type { ConsentVersion } from '@/features/legal/documents'

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
    useFeatureFlags()
    const { t } = useTranslation()
    const { isAuthenticated, token, userHash } = useAuth()
    const voiceEnabled = isCallsFeatureEnabled()
    const [consentOpen, setConsentOpen] = useState(true)
    const [isAccepting, setIsAccepting] = useState(false)

    // Call setup: the voice picked for calls with this character (remembered per character),
    // else the chat's own voice. Re-read when the character or the account changes.
    const characterId = character?.id ?? null
    const characterVoice = parseStoredVoice(character?.voice)
    const pickKey = `${userHash ?? ''}|${characterId ?? ''}`
    const [pickState, setPickState] = useState(() => ({ key: pickKey, voice: readCallVoicePick(userHash, characterId) }))
    if (pickState.key !== pickKey) setPickState({ key: pickKey, voice: readCallVoicePick(userHash, characterId) })
    const callVoice = pickState.key === pickKey ? pickState.voice : null
    const pickCallVoice = (voice: StoredCharacterVoice | null) => {
        setPickState({ key: pickKey, voice })
        saveCallVoicePick(userHash, characterId, voice)
    }
    const [modelUnassigned, setModelUnassigned] = useState(false)
    // The start dialog reopened from the end panel ("Call settings"): "Not now" closes it
    // and stays on the call screen instead of leaving for the text chat.
    const [setupReopened, setSetupReopened] = useState(false)

    // Calls at all (the account's switches), and the chosen voice's provider: a Fish voice
    // needs Fish's own healthy call surface (fail closed).
    const voiceActive = voiceEnabled && isAuthenticated
    const generalAvailability = useVoiceAvailability(apiService, voiceActive)
    const fishAvailability = useVoiceAvailability(apiService, voiceActive, 0, 'fish_audio')
    const fishCall = (callVoice ?? characterVoice)?.provider === 'fish_audio'
    const availability = fishCall ? fishAvailability : generalAvailability
    const voiceUnavailable = fishCall && generalAvailability.calls_available && !fishAvailability.calls_available

    const controller = useVoiceCallController({
        sessionId: voiceEnabled && isAuthenticated && token && !Number.isNaN(sessionId) ? sessionId : null,
        workspaceId,
        ensureSession,
        authKey: token ?? null,
        consentGranted: true,
        consentVersion: availability.consentVersion,
        enabled: voiceEnabled,
        callVoice,
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
    // already running continues. A voice that cannot call is the setup's to fix, not a block.
    const callsAvailable = generalAvailability.calls_available
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
        if (isAccepting || startBlocked || voiceUnavailable || modelUnassigned) return
        setIsAccepting(true)
        try {
            const started = await controller.startCall()
            if (started) {
                setConsentOpen(false)
                setSetupReopened(false)
            }
        } finally {
            setIsAccepting(false)
        }
    }

    const [lastVoiceSessionId, setLastVoiceSessionId] = useState<string | null>(null)
    if (controller.voiceSessionId && controller.voiceSessionId !== lastVoiceSessionId) {
        setLastVoiceSessionId(controller.voiceSessionId)
    }

    const [savedSegments, setSavedSegments] = useState<readonly import('@/shared').CallTranscriptSegment[] | undefined>(undefined)
    const callOver = !consentOpen && (controller.state === 'ended' || controller.state === 'error')
    useEffect(() => {
        if (!callOver || !lastVoiceSessionId || !sessionApi) return
        let cancelled = false
        sessionApi
            .getVoiceCallTranscript(lastVoiceSessionId)
            .then((res) => {
                if (!cancelled && res.segments) setSavedSegments(res.segments)
            })
            .catch(() => {
                // Non-critical: live transcript text remains visible even if audio links cannot be hydrated.
            })
        return () => {
            cancelled = true
        }
    }, [callOver, lastVoiceSessionId, sessionApi])

    const leave = async () => {
        try {
            await Promise.race([
                controller.endCall(),
                new Promise<void>((resolve) => setTimeout(resolve, 400)),
            ])
        } catch {
            // Always navigate back to text even if endCall rejects.
        }
        onSwitchToText()
    }

    const setup = (
        <CallSetup
            name={name}
            characterVoice={characterVoice}
            pick={callVoice}
            onPick={pickCallVoice}
            voiceUnavailable={voiceUnavailable}
            recommendedFor={characterId && character?.role !== 'persona' ? { cardId: characterId, workspaceId: workspaceId ?? null } : null}
            disabled={isAccepting}
            model={<LlmFeatureControl feature="callbot" onUnassignedChange={setModelUnassigned} />}
        />
    )

    return (
        <CallScreenView
            consentVersion={availability.consentVersion}
            setup={setup}
            setupBlocked={voiceUnavailable || modelUnassigned}
            onOpenSetup={() => {
                setSetupReopened(true)
                setConsentOpen(true)
            }}
            name={name}
            imageUrl={character?.image_url ?? null}
            state={startBlocked ? 'error' : controller.state}
            isMuted={controller.isMuted}
            elapsedSeconds={controller.elapsedSeconds}
            remainingSeconds={controller.remainingSeconds}
            inputLevel={controller.inputLevel}
            transcript={controller.transcript}
            assistantText={controller.assistantText}
            transcriptLines={controller.transcriptLines}
            savedSegments={savedSegments}
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
                if (setupReopened) setSetupReopened(false)
                else onSwitchToText()
            }}
            onMute={controller.mute}
            onUnmute={controller.unmute}
            onBargeIn={() => controller.bargeIn()}
            onEnd={() => void leave()}
            onSwitchToText={() => void leave()}
            breakNudgeMinutes={readSafeguards(voiceCapabilities).break_nudge_minutes}
            voiceNote={voiceNote}
            onRefreshVoice={refreshVoice}
            audioUnsupported={controller.audioUnsupported}
        />
    )
}

export interface CallScreenViewProps {
    consentVersion?: ConsentVersion
    /** Call setup (voice and conversation model), shown in the start dialog. */
    setup?: ReactNode
    /** The setup is not ready (no usable voice or conversation model): the start waits. */
    setupBlocked?: boolean
    /** Reopen the start dialog with the setup (end panel "Call settings"). */
    onOpenSetup?: () => void
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
    /** The running transcript of this call; captions show its last exchange, the panel shows it all. */
    transcriptLines?: readonly LiveTranscriptLine[]
    /** Saved transcript segments hydrated when the call ends, enabling audio replay in the transcript panel. */
    savedSegments?: readonly import('@/shared').CallTranscriptSegment[]
    /** Open the transcript panel on mount (stories and visual review). */
    defaultTranscriptOpen?: boolean
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
    consentVersion = 'voice-v2',
    setup,
    setupBlocked = false,
    onOpenSetup,
    name,
    imageUrl,
    state,
    isMuted,
    elapsedSeconds,
    remainingSeconds = null,
    inputLevel,
    transcript,
    assistantText,
    transcriptLines,
    savedSegments,
    defaultTranscriptOpen = false,
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
    useFeatureFlags()
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
    // A refusal the call setup can fix (the voice, the conversation model): the settings lead, not a redial.
    const setupError = state === 'error' && isSetupCallError(error?.code)
    const showTimeLeft = isActive && remainingSeconds !== null && remainingSeconds <= 60

    const lines = transcriptLines ?? []
    const [transcriptOpen, setTranscriptOpen] = useState(defaultTranscriptOpen)
    const transcriptId = useId()
    const hasTranscript = lines.length > 0
    const showTranscript = transcriptOpen && (isActive || hasTranscript)

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
    // Captions follow the conversation in order: the last user line, then the reply to it.
    // Without a running transcript (stories, older callers) they fall back to the two caption props.
    const captionLines: { key: string; role: 'user' | 'assistant'; text: string; interrupted?: boolean }[] = transcriptLines
        ? lines.slice(-2).map((line) => ({ key: line.id, role: line.role, text: lineDisplayText(line), interrupted: line.interrupted })).filter((line) => line.text)
        : [
            // R1-FE-05: captions never show speech markup (`<#0.5#>`, `(laughs)`); they may end mid-token while the reply streams.
            ...(assistantText ? [{ key: 'assistant', role: 'assistant' as const, text: stripSpeechMarkupV1(assistantText, { partial: true }) }] : []),
            ...(transcript ? [{ key: 'user', role: 'user' as const, text: transcript }] : []),
        ]
    // Nothing said yet on a live call: tell the user the character is waiting for them.
    const showFirstTurnHint = state === 'listening' && captionLines.length === 0 && !hasTranscript

    // "M" toggles the microphone during a call (never while typing in a field).
    useEffect(() => {
        if (!isActive) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'm' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target as HTMLElement | null
            if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
            event.preventDefault()
            if (isMuted) onUnmute()
            else onMute()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [isActive, isMuted, onMute, onUnmute])

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-900 text-parchment-50" data-testid="call-screen">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <GlowBackdrop variant="center" />
            </div>

            {/* Top: leave / switch to text, timer, transcript toggle */}
            <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-4 py-3">
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={MessageSquareText} size={15} />} onClick={onSwitchToText}>
                    {t('call.screen.switchToText')}
                </Button>
                <div className="flex items-center gap-2">
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
                    {transcriptLines && (isActive || hasTranscript) && (
                        <IconButton
                            label={transcriptOpen ? t('call.live.hide') : t('call.live.show')}
                            size="sm"
                            tone={transcriptOpen ? 'active' : 'default'}
                            aria-pressed={transcriptOpen}
                            aria-controls={transcriptOpen ? transcriptId : undefined}
                            onClick={() => setTranscriptOpen((open) => !open)}
                        >
                            <Icon icon={ScrollText} size={16} />
                        </IconButton>
                    )}
                </div>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* Stage: identity + status + waveform + captions. Compact while the transcript is open on small screens. */}
                <div className={cx('min-h-0 overflow-y-auto px-6 text-center', showTranscript ? 'shrink-0 lg:flex-1' : 'flex-1')}>
                    <div className={cx('flex min-h-full flex-col items-center justify-center', showTranscript ? 'gap-2 py-2 lg:gap-5 lg:py-5' : 'gap-5 py-5')}>
                        <div className={cx('rounded-full transition-all duration-300 ease-out', glowClass)}>
                            <span className={cx(showTranscript ? 'hidden lg:inline' : 'inline')}>
                                <Avatar name={name} src={imageUrl ?? null} size={188} ring={avatarRing} status={avatarStatus} />
                            </span>
                            {showTranscript && (
                                <span className="inline lg:hidden">
                                    <Avatar name={name} src={imageUrl ?? null} size={72} ring={avatarRing} status={avatarStatus} />
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <h1 className={cx('font-display font-semibold leading-tight text-parchment-50', showTranscript ? 'text-h3 lg:text-h2' : 'text-h2')}>{name}</h1>
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

                        <CallWaveform level={inputLevel} tone={waveTone} animated={isSpeaking} className={cx('w-full max-w-[320px]', showTranscript && 'hidden lg:flex')} />

                        {/* Live captions: the current exchange. The transcript panel carries the rest. */}
                        {!showTranscript && (
                            <div className="flex min-h-[3.5rem] w-full max-w-[560px] flex-col gap-2 text-[15px] leading-relaxed" data-testid="call-captions">
                                {captionLines.map((line, index) => (
                                    <p
                                        key={line.key}
                                        className={cx(
                                            'border-l-2 py-2 pl-4 text-left text-parchment-100 transition-opacity',
                                            line.role === 'assistant' ? 'border-arcane-500/40' : 'border-ember-500/40',
                                            captionLines.length > 1 && index === 0 && 'opacity-70',
                                        )}
                                    >
                                        <span className={cx('font-semibold', line.role === 'assistant' ? 'text-arcane-300' : 'text-ember-300')}>
                                            {line.role === 'assistant' ? `${name}:` : t('call.screen.youLabel')}
                                        </span>{' '}
                                        {line.text}
                                        {line.interrupted && <span className="ml-1.5 text-caption italic text-parchment-400">{t('call.live.interrupted')}</span>}
                                    </p>
                                ))}
                                {showFirstTurnHint && (
                                    <p className="text-sm text-parchment-300" data-testid="call-first-turn-hint">{t('call.screen.firstTurnHint', { name })}</p>
                                )}
                            </div>
                        )}

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

                {showTranscript && (
                    <CallLiveTranscript
                        id={transcriptId}
                        lines={lines}
                        name={name}
                        savedSegments={savedSegments}
                        className="mx-4 mb-2 flex-1 rounded-xl border border-parchment-50/10 bg-ink-800/70 lg:mx-0 lg:mb-0 lg:w-[380px] lg:flex-none lg:rounded-none lg:border-y-0 lg:border-r-0"
                    />
                )}
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
                            {onCallAgain && canRedial && !setupError && (
                                <Button variant="primary" size="sm" iconLeft={<Icon icon={Phone} size={15} />} onClick={onCallAgain} disabled={isAccepting}>
                                    {t('call.screen.callAgain')}
                                </Button>
                            )}
                            {onOpenSetup && setup && canRedial && (
                                <Button variant={setupError ? 'primary' : 'secondary'} size="sm" iconLeft={<Icon icon={Settings2} size={15} />} onClick={onOpenSetup} disabled={isAccepting}>
                                    {t('call.setup.open')}
                                </Button>
                            )}
                            {hasTranscript && !transcriptOpen && (
                                <Button variant="secondary" size="sm" iconLeft={<Icon icon={ScrollText} size={15} />} onClick={() => setTranscriptOpen(true)}>
                                    {t('call.live.show')}
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
                        hint={t('call.screen.muteShortcut')}
                        keyShortcuts="M"
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
                {t(consentVersion === 'voice-v3' ? 'call.transcript.privacyNote' : 'call.screen.privacyNote')}
            </p>

            <VoiceConsentModal
                consentVersion={consentVersion}
                open={consentOpen}
                staleConsent={error?.category === 'consent_stale'}
                isAccepting={isAccepting}
                setup={setup}
                startDisabled={setupBlocked}
                onAccept={onAcceptConsent}
                onDecline={onDeclineConsent}
            />
        </div>
    )
}

/** End-panel "Use the card’s current voice": the new voice applies from the next call. */
function CallVoiceRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
    useFeatureFlags()
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
    hint,
    keyShortcuts,
    pressed,
    icon,
    tone,
    prominent = false,
    disabled = false,
    onClick,
}: {
    label: string
    /** Extra tooltip text (e.g. the keyboard shortcut). */
    hint?: string
    keyShortcuts?: string
    /** Toggle buttons (mute) expose their state. */
    pressed?: boolean
    icon: typeof Mic
    tone: 'neutral' | 'danger' | 'arcane'
    prominent?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    useFeatureFlags()
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
            aria-pressed={pressed}
            aria-keyshortcuts={keyShortcuts}
            title={hint ? `${label} (${hint})` : label}
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
