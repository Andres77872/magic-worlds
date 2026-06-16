/**
 * CallScreen — the immersive, hands-free voice-call surface.
 *
 * Split into two pieces:
 *   - `CallScreen` (container): owns `useVoiceCallController` + the consent gate, and
 *     wires them to the view. This is what the app mounts.
 *   - `CallScreenView` (pure): the immersive layout — a large character portrait that
 *     pulses while listening / glows while the character speaks, a big status line + timer,
 *     a live waveform driven by the mic level, live captions, and large Mute / End /
 *     Interrupt controls. It takes plain props, so stories + unit tests drive it directly
 *     without a socket. Turn-taking is automatic (VAD) — there is no push-to-talk.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, MessageSquareText, Mic, MicOff, PhoneOff, Volume2, Waves } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import type { Character } from '@/shared'
import type { VoiceCallState } from '@/shared/types/voice.types'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { Avatar, Button, GlowBackdrop, Icon, cx } from '@/ui/primitives'
import { useVoiceCallController, type VoiceCallControllerError } from '@/features/interaction/hooks/useVoiceCallController'
import { VoiceConsentModal } from '@/features/interaction/components/VoiceConsentModal'
import {
    ACTIVE_CALL_STATES,
    callStateLabel,
    callErrorCopy,
    formatElapsed,
} from '@/features/interaction/voiceCallLabels'
import { CallWaveform } from './CallWaveform'

interface CallScreenProps {
    character?: Character
    persona?: Character
    sessionId: number
    /** Leave the call and return to the text chat. */
    onSwitchToText: () => void
}

export function CallScreen({ character, sessionId, onSwitchToText }: CallScreenProps) {
    const { t } = useTranslation()
    const { isAuthenticated, token } = useAuth()
    const voiceEnabled = isFrontendVoiceModeEnabled()
    const [consentOpen, setConsentOpen] = useState(true)
    const [isAccepting, setIsAccepting] = useState(false)

    const controller = useVoiceCallController({
        sessionId: voiceEnabled && isAuthenticated && token && !Number.isNaN(sessionId) ? sessionId : null,
        authKey: token ?? null,
        consentGranted: true,
        enabled: voiceEnabled,
        // VAD turn-taking tuning. Add `speechThreshold` here (0..1 RMS) to override the
        // worklet default if mics under-/over-trigger; lower = more sensitive.
        vad: { silenceMsToEnd: 800, minSpeechMs: 250 },
    })

    const name = character?.name?.trim() || t('call.screen.fallbackName')

    const acceptConsent = async () => {
        if (isAccepting) return
        setIsAccepting(true)
        try {
            const started = await controller.startCall()
            if (started) setConsentOpen(false)
        } finally {
            setIsAccepting(false)
        }
    }

    const leave = (reason: 'user' | 'navigation' = 'user') => {
        void controller.endCall(reason)
        onSwitchToText()
    }

    return (
        <CallScreenView
            name={name}
            imageUrl={character?.image_url ?? null}
            state={controller.state}
            isMuted={controller.isMuted}
            elapsedSeconds={controller.elapsedSeconds}
            inputLevel={controller.inputLevel}
            vadActive={controller.vadActive}
            transcript={controller.transcript}
            assistantText={controller.assistantText}
            error={controller.error}
            consentOpen={consentOpen}
            isAccepting={isAccepting}
            onAcceptConsent={acceptConsent}
            onDeclineConsent={() => {
                setConsentOpen(false)
                onSwitchToText()
            }}
            onMute={controller.mute}
            onUnmute={controller.unmute}
            onBargeIn={() => controller.bargeIn('button')}
            onEnd={() => leave('user')}
            onSwitchToText={() => leave('user')}
        />
    )
}

export interface CallScreenViewProps {
    name: string
    imageUrl?: string | null
    state: VoiceCallState
    isMuted: boolean
    elapsedSeconds: number
    /** Live mic level 0..1 for the reactive waveform. */
    inputLevel: number
    /** False when the AudioWorklet VAD couldn't load (degraded, chunked capture). */
    vadActive: boolean
    transcript?: string | null
    assistantText?: string
    error?: VoiceCallControllerError | null
    consentOpen: boolean
    isAccepting: boolean
    onAcceptConsent: () => void
    onDeclineConsent: () => void
    onMute: () => void
    onUnmute: () => void
    onBargeIn: () => void
    onEnd: () => void
    onSwitchToText: () => void
}

export function CallScreenView({
    name,
    imageUrl,
    state,
    isMuted,
    elapsedSeconds,
    inputLevel,
    vadActive,
    transcript,
    assistantText,
    error,
    consentOpen,
    isAccepting,
    onAcceptConsent,
    onDeclineConsent,
    onMute,
    onUnmute,
    onBargeIn,
    onEnd,
    onSwitchToText,
}: CallScreenViewProps) {
    const { t } = useTranslation()
    const isActive = ACTIVE_CALL_STATES.has(state)
    const isAssistant = state === 'assistant_speaking' || state === 'assistant_thinking'
    const isSpeaking = state === 'assistant_speaking'
    const isUserTurn = state === 'listening' || state === 'user_speaking'
    const isConnecting = state === 'connecting' || state === 'reconnecting' || state === 'requesting_permission'
    const visibleError = callErrorCopy(t, error, state)

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

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-900 text-parchment-50" data-testid="call-screen">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <GlowBackdrop variant="center" animated />
            </div>

            {/* Top: leave / switch to text */}
            <div className="relative z-10 flex items-center justify-between px-4 py-3">
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={MessageSquareText} size={15} />} onClick={onSwitchToText}>
                    {t('call.screen.switchToText')}
                </Button>
                {isActive && <span className="font-mono text-sm text-parchment-300">{formatElapsed(elapsedSeconds)}</span>}
            </div>

            {/* Center: identity + status + waveform + captions */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                <div className={cx('rounded-full transition-all duration-300 ease-out', glowClass)}>
                    <Avatar name={name} src={imageUrl ?? null} size={188} ring={avatarRing} status={avatarStatus} />
                </div>

                <div className="flex flex-col items-center gap-1">
                    <h1 className="font-display text-h2 font-semibold leading-tight text-parchment-50">{name}</h1>
                    <p className={cx('font-ui text-sm font-semibold tracking-wide', isAssistant ? 'text-arcane-300' : isUserTurn ? 'text-ember-300' : 'text-parchment-300')}>
                        {isConnecting && <Icon icon={Loader2} size={13} className="mr-1 inline animate-spin" />}
                        {isSpeaking && <Icon icon={Volume2} size={13} className="mr-1 inline" />}
                        {statusLabel}
                    </p>
                </div>

                <CallWaveform level={inputLevel} tone={waveTone} animated={isSpeaking} className="w-full max-w-[320px]" />

                {/* Live captions */}
                <div className="flex min-h-[3.5rem] w-full max-w-[560px] flex-col gap-2 text-[15px] leading-relaxed">
                    {assistantText && (
                        <p className="rounded-xl border border-arcane-500/25 bg-arcane-500/10 px-4 py-2.5 text-parchment-100">
                            <span className="font-semibold text-arcane-300">{name}:</span> {assistantText}
                        </p>
                    )}
                    {transcript && (
                        <p className="rounded-xl border border-ember-500/20 bg-ember-500/10 px-4 py-2.5 text-parchment-100">
                            <span className="font-semibold text-ember-300">{t('call.screen.youLabel')}</span> {transcript}
                        </p>
                    )}
                </div>

                {!vadActive && (
                    <p className="rounded-lg border border-ember-500/30 bg-ember-500/10 px-3 py-1.5 text-caption text-ember-200">
                        {t('call.screen.vadDegraded')}
                    </p>
                )}

                {visibleError && (
                    <p role="alert" className="flex max-w-[560px] items-start gap-2 rounded-lg border border-blood-500/30 bg-blood-500/10 px-3 py-2 text-sm text-blood-500">
                        <Icon icon={AlertTriangle} size={16} className="mt-0.5 shrink-0" />
                        <span>
                            {visibleError}
                            {error?.code && <span className="ml-1 font-mono text-caption opacity-70">({error.code})</span>}
                        </span>
                    </p>
                )}
            </div>

            {/* Bottom: large controls */}
            <div className="relative z-10 flex items-center justify-center gap-4 px-6 pb-7 pt-3">
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

            <p className="relative z-10 pb-4 text-center text-caption text-parchment-400">
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
