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
import { AlertTriangle, ArrowLeft, Mic, PhoneCall, Volume2 } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import type { CallSummary, CallTranscriptSegment, Character } from '@/shared'
import { EmptyState } from '@/ui/components'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon, IconTile, PageHeader } from '@/ui/primitives'
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'
import { callDisplay, formatCallDuration, formatCallTime } from '../callTransforms'

interface CallTranscriptViewProps {
    call: CallSummary
    characters: Character[]
    onBack: () => void
    /** Strip speech markup from the saved character lines (default true). */
    stripMarkup?: boolean
}

function lineText(text: string | null | undefined, stripMarkup: boolean): string | null | undefined {
    return stripMarkup && text ? stripSpeechMarkupV1(text) : text
}

/** One-shot visibility gate (same approach as the lazy Portrait): flips true once the node nears the viewport. */
function useNearViewport<T extends Element>(enabled: boolean) {
    const ref = useRef<T>(null)
    const [near, setNear] = useState(() => !enabled || typeof IntersectionObserver === 'undefined')

    useEffect(() => {
        if (near) return
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setNear(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px 0px', threshold: 0 },
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [near])

    return [ref, near] as const
}

function CharacterTranscriptLine({ segment, speaker, stripMarkup }: { segment: CallTranscriptSegment; speaker: string; stripMarkup: boolean }) {
    const { t } = useTranslation()
    const [lineRef, nearViewport] = useNearViewport<HTMLDivElement>(Boolean(segment.audio_url))
    const { src, loading } = useAuthenticatedMediaUrl(nearViewport ? segment.audio_url ?? undefined : undefined, 'audio/mpeg')
    return (
        <div ref={lineRef} className="border-l-2 border-arcane-500/30 py-2 pl-4 text-body text-parchment-100">
            <p>
                <span className="mb-1 flex items-center gap-1 text-caption font-semibold text-arcane-300">
                    <Icon icon={Volume2} size={12} />
                    {speaker}
                </span>{' '}
                {lineText(segment.text, stripMarkup)}
            </p>
            {segment.audio_url && (
                <div className="mt-2">
                    {src ? (
                        <VoiceClipPlayer src={src} title={t('call.transcript.voiceClip', { speaker })} durationMs={segment.duration_ms} />
                    ) : (
                        <span className="text-caption text-parchment-400">{loading ? t('call.transcript.loadingAudio') : ''}</span>
                    )}
                </div>
            )}
        </div>
    )
}

function UserTranscriptLine({ segment }: { segment: CallTranscriptSegment }) {
    const { t } = useTranslation()
    return (
        <div className="border-l-2 border-ember-500/30 py-2 pl-4 text-body text-parchment-100">
            <p>
                <span className="mb-1 flex items-center gap-1 text-caption font-semibold text-ember-300">
                    <Icon icon={Mic} size={12} />
                    {t('call.transcript.youSaid')}
                </span>{' '}
                {segment.text}
            </p>
        </div>
    )
}

export function CallTranscriptView({ call, characters, onBack, stripMarkup = true }: CallTranscriptViewProps) {
    const { t } = useTranslation()
    const [segments, setSegments] = useState<CallTranscriptSegment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const display = useMemo(() => callDisplay(call, characters, t), [call, characters, t])
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
                setSegments(response.segments ?? [])
            })
            .catch((err) => {
                if (cancelled) return
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

    const duration = formatCallDuration(call.duration_seconds)
    const subtitleParts = [formatCallTime(call), duration].filter(Boolean)

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
                    <Button variant="secondary" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack}>
                        {t('call.transcript.backToCalls')}
                    </Button>
                }
            />

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
