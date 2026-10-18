/**
 * Reusable transcript line components for saved voice calls (used by CallTranscriptView
 * and the CallScreen end-of-call transcript drawer).
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, RotateCcw, Volume2 } from 'lucide-react'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import type { CallTranscriptSegment } from '@/shared'
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon } from '@/ui/primitives'

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

export function SavedTranscriptAudioClip({
    audioUrl,
    speaker,
    durationMs,
}: {
    audioUrl: string
    speaker: string
    durationMs?: number | null
}) {
    const { t } = useTranslation()
    const [clipRef, nearViewport] = useNearViewport<HTMLDivElement>(true)
    const { src, loading, error, retry } = useAuthenticatedMediaUrl(nearViewport ? audioUrl : undefined, 'audio/mpeg')
    return (
        <div ref={clipRef} className="mt-2">
            {src ? (
                <VoiceClipPlayer src={src} title={t('call.transcript.voiceClip', { speaker })} durationMs={durationMs} />
            ) : error ? (
                <div className="flex flex-wrap items-center gap-2 text-caption text-blood-500" data-testid="call-transcript-audio-error">
                    <span>{t('call.transcript.audioLoadFailed')}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={<Icon icon={RotateCcw} size={12} />}
                        onClick={retry}
                    >
                        {t('common.tryAgain')}
                    </Button>
                </div>
            ) : (
                <span className="text-caption text-parchment-400">{loading ? t('call.transcript.loadingAudio') : ''}</span>
            )}
        </div>
    )
}

export function CharacterTranscriptLine({
    segment,
    speaker,
    stripMarkup = true,
}: {
    segment: CallTranscriptSegment
    speaker: string
    stripMarkup?: boolean
}) {
    return (
        <div className="border-l-2 border-arcane-500/30 py-2 pl-4 text-body text-parchment-100">
            <p>
                <span className="mb-1 flex items-center gap-1 text-caption font-semibold text-arcane-300">
                    <Icon icon={Volume2} size={12} />
                    {speaker}
                </span>{' '}
                {lineText(segment.text, stripMarkup)}
            </p>
            {segment.audio_url && (
                <SavedTranscriptAudioClip
                    audioUrl={segment.audio_url}
                    speaker={speaker}
                    durationMs={segment.duration_ms}
                />
            )}
        </div>
    )
}

export function UserTranscriptLine({ segment }: { segment: CallTranscriptSegment }) {
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
