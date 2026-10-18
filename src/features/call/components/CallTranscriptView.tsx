/**
 * CallTranscriptView — the saved transcript of one past voice call.
 *
 * User lines are STT text only (raw microphone audio is never stored). Character lines
 * additionally play the saved AI voice audio via the shared VoiceClipPlayer, fetched as an
 * authenticated blob (the asset URL is protected). Clips are fetched only once their line
 * nears the viewport, so opening a long call does not download every clip in parallel.
 *
 * Character lines are shown without the speech markup the model may write into them
 * (R1-FE-05; `stripMarkup`, on by default); user lines (STT) render exactly as saved.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, MessageSquareText, Phone, PhoneCall } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import type { CallSummary, CallTranscriptSegment, Character } from '@/shared'
import { EmptyState } from '@/ui/components'
import { Badge, Button, Icon, IconTile, PageHeader } from '@/ui/primitives'
import { callDisplay, callMetaLine, formatCallDuration, formatCallTime } from '../callTransforms'
import { CharacterTranscriptLine, UserTranscriptLine } from './CallTranscriptLines'

interface CallTranscriptViewProps {
    call: CallSummary
    characters: Character[]
    onBack: () => void
    /** Open the character chat this call belongs to. */
    onOpenChat?: (call: CallSummary) => void
    /** Start a new call in the same chat or with the same character. */
    onCallAgain?: (call: CallSummary) => void
    /** Called when the server reports 404 (call deleted or all lines purged). */
    onUnavailable?: (voiceSessionId: string) => void
    /** Strip speech markup from the saved character lines (default true). */
    stripMarkup?: boolean
}

export function CallTranscriptView({
    call,
    characters,
    onBack,
    onOpenChat,
    onCallAgain,
    onUnavailable,
    stripMarkup = true,
}: CallTranscriptViewProps) {
    const { t } = useTranslation()
    const [segments, setSegments] = useState<CallTranscriptSegment[]>([])
    const [resolvedCall, setResolvedCall] = useState<CallSummary>(call)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const onUnavailableRef = useRef(onUnavailable)
    useEffect(() => {
        onUnavailableRef.current = onUnavailable
    }, [onUnavailable])

    useEffect(() => {
        setResolvedCall(call)
    }, [call])

    const activeCall = resolvedCall.voice_session_id === call.voice_session_id ? resolvedCall : call
    const display = useMemo(() => callDisplay(activeCall, characters, t), [activeCall, characters, t])
    // Workspace R1: the history (and so this call) belongs to the committed workspace.
    const { api, capture, isCurrent } = useWorkspace()

    useEffect(() => {
        if (!api) return
        let cancelled = false
        const scope = capture()
        setLoading(true)
        setError(null)
        api
            .getVoiceCallTranscript(call.voice_session_id)
            .then((response) => {
                if (cancelled || !isCurrent(scope)) return
                if (response.call) setResolvedCall((prev) => ({ ...prev, ...response.call }))
                setSegments(response.segments ?? [])
            })
            .catch((err) => {
                if (cancelled) return
                const isNotFound = (typeof ApiError === 'function' && err instanceof ApiError && err.status === 404)
                    || (Boolean(err) && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 404)
                if (isNotFound && onUnavailableRef.current) {
                    onUnavailableRef.current(call.voice_session_id)
                    return
                }
                console.error('Failed to load call transcript:', err)
                setError(t('call.transcript.loadError'))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [api, call.voice_session_id, capture, isCurrent, t])

    const duration = formatCallDuration(activeCall.duration_seconds)
    const subtitleParts = [formatCallTime(activeCall), duration].filter(Boolean)
    const metaLine = callMetaLine(
        { ...activeCall, segment_count: segments.length || activeCall.segment_count },
        t,
    )

    return (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5" data-testid="call-transcript-view">
            <PageHeader
                eyebrow={t('call.transcript.eyebrow')}
                eyebrowTone="arcane"
                icon={<IconTile icon={PhoneCall} tone="arcane" />}
                title={t('call.transcript.title', { name: display.name })}
                subtitle={subtitleParts.join(' · ')}
                size="md"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {onOpenChat && activeCall.chat_id != null && String(activeCall.chat_id) !== '' && (
                            <Button
                                variant="secondary"
                                iconLeft={<Icon icon={MessageSquareText} size={16} />}
                                onClick={() => onOpenChat(activeCall)}
                                data-testid="call-transcript-open-chat"
                            >
                                {t('call.transcript.openChat')}
                            </Button>
                        )}
                        {onCallAgain && (
                            <Button
                                variant="secondary"
                                iconLeft={<Icon icon={Phone} size={16} />}
                                onClick={() => onCallAgain(activeCall)}
                                data-testid="call-transcript-call-again"
                            >
                                {t('call.history.callAgain')}
                            </Button>
                        )}
                        <Button variant="secondary" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack}>
                            {t('call.transcript.backToCalls')}
                        </Button>
                    </div>
                }
            />

            {!loading && !error && (metaLine || activeCall.end_reason) && (
                <div className="flex flex-wrap items-center gap-2" data-testid="call-transcript-meta">
                    {metaLine && <Badge tone="glass">{metaLine}</Badge>}
                    {activeCall.end_reason && (
                        <Badge tone="arcane">{t(`call.transcript.endReason.${activeCall.end_reason}`, { defaultValue: activeCall.end_reason })}</Badge>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col gap-2" aria-busy="true">
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="image-shimmer h-12 rounded-lg border border-parchment-50/10 bg-ink-800/60" />
                    ))}
                </div>
            ) : error ? (
                <p role="alert" className="flex gap-2 rounded-lg border border-blood-500/30 bg-blood-500/10 px-3 py-2 text-sm text-blood-500">
                    <Icon icon={AlertTriangle} size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </p>
            ) : segments.length === 0 ? (
                <EmptyState icon={<Icon icon={PhoneCall} size={40} />} message={t('call.transcript.emptyMessage')} secondaryText={t('call.transcript.emptyHelper')} />
            ) : (
                <div className="flex flex-col gap-2.5">
                    {segments.map((segment) =>
                        segment.role === 'assistant' ? (
                            <CharacterTranscriptLine key={segment.segment_id} segment={segment} speaker={display.name} stripMarkup={stripMarkup} />
                        ) : (
                            <UserTranscriptLine key={segment.segment_id} segment={segment} />
                        ),
                    )}
                </div>
            )}

            <p className="text-center text-caption text-parchment-400">
                {t('call.transcript.privacyNote')}
            </p>
        </div>
    )
}

