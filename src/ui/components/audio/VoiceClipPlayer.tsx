/**
 * VoiceClipPlayer — the Reverie play bar for EPHEMERAL audio (voice-studio
 * previews/tests). Same visual language as AudioWavePlayer (ember circular
 * toggle + waveform seek strip + mono time readout) but it owns its own
 * <audio> element instead of routing through the global playlist — a throwaway
 * blob: preview must never leak into the user-facing dock. Still participates
 * in app-wide exclusive audio focus, so playing a clip pauses the playlist and
 * vice-versa.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { cx, Icon } from '@/ui/primitives'
import { pseudoPeaks } from './audioData'
import { claimAudioFocus, releaseAudioFocus } from './audioFocus'
import { formatSeconds } from './formatSeconds'
import { WaveformSeekBar } from './WaveformSeekBar'

export interface VoiceClipPlayerProps {
    /** Resolved audio URL (typically a decoded `blob:` object URL). */
    src: string
    /** Accessible name fragment, e.g. "designed preview". */
    title?: string
    /** Duration shown before metadata loads. */
    durationMs?: number | null
    className?: string
}

export function VoiceClipPlayer({ src, title, durationMs, className }: VoiceClipPlayerProps) {
    const { t } = useTranslation()
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState<number | null>(
        durationMs && durationMs > 0 ? durationMs / 1000 : null,
    )
    const [error, setError] = useState(false)

    const peaks = useMemo(() => pseudoPeaks(src), [src])
    const trackName = title?.trim() || t('ui.audio.voiceClipFallback')

    // Reset transport state when the source changes — React's "adjust state during
    // render" pattern, which avoids a cascading setState-in-effect.
    const [prevSrc, setPrevSrc] = useState(src)
    if (src !== prevSrc) {
        setPrevSrc(src)
        setIsPlaying(false)
        setCurrentTime(0)
        setError(false)
    }

    // Bind media events once; releasing focus on unmount keeps the exclusive
    // audio contract intact when the panel is torn down mid-playback.
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        const onTime = () => setCurrentTime(audio.currentTime)
        const onMeta = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
        }
        const onPlay = () => {
            claimAudioFocus(audio)
            setIsPlaying(true)
        }
        const onPause = () => setIsPlaying(false)
        const onEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }
        const onError = () => setError(true)
        audio.addEventListener('timeupdate', onTime)
        audio.addEventListener('loadedmetadata', onMeta)
        audio.addEventListener('play', onPlay)
        audio.addEventListener('pause', onPause)
        audio.addEventListener('ended', onEnded)
        audio.addEventListener('error', onError)
        return () => {
            audio.pause()
            releaseAudioFocus(audio)
            audio.removeEventListener('timeupdate', onTime)
            audio.removeEventListener('loadedmetadata', onMeta)
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('ended', onEnded)
            audio.removeEventListener('error', onError)
        }
    }, [])

    const toggle = (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const audio = audioRef.current
        if (!audio) return
        if (error) {
            setError(false)
            audio.load()
            return
        }
        if (audio.paused) void audio.play().catch(() => setError(true))
        else audio.pause()
    }

    const seekRatio = (ratio: number) => {
        const audio = audioRef.current
        if (!audio || !duration) return
        audio.currentTime = ratio * duration
        setCurrentTime(audio.currentTime)
    }

    const engaged = isPlaying || currentTime > 0
    const progress = duration && duration > 0 ? currentTime / duration : 0

    return (
        <div className={cx('flex min-w-0 flex-col gap-1', className)} data-testid="voice-clip-player">
            {/* Owned, off-DOM-flow audio element — never enters the playlist dock. */}
            <audio ref={audioRef} src={src} preload="metadata" className="hidden" aria-hidden="true" />
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    aria-label={
                        error
                            ? t('ui.audio.retry', { title: trackName })
                            : isPlaying
                              ? t('ui.audio.pause', { title: trackName })
                              : t('ui.audio.play', { title: trackName })
                    }
                    aria-pressed={isPlaying}
                    onClick={toggle}
                    className={cx(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                        error
                            ? 'border-blood-500/50 text-blood-500 hover:border-blood-500/70'
                            : isPlaying
                              ? 'border-ember-500/60 bg-ink-900/60 text-ember-300 shadow-glow-ember'
                              : cx(
                                    'border-parchment-50/20 bg-ink-900/60 text-parchment-50 hover:bg-ink-900/80',
                                    'hover:border-ember-500/50 hover:text-ember-200 hover:shadow-glow-ember',
                                    engaged && 'border-ember-500/40 text-ember-200',
                                ),
                    )}
                >
                    <Icon icon={error ? RotateCcw : isPlaying ? Pause : Play} size={16} />
                </button>

                <div className="min-w-0 flex-1">
                    <WaveformSeekBar
                        peaks={peaks}
                        progress={progress}
                        currentTime={currentTime}
                        duration={duration}
                        onSeekRatio={seekRatio}
                        engaged={engaged}
                        disabled={error}
                        label={t('ui.audio.seekWithin', { title: trackName })}
                        className={cx(!engaged && 'opacity-70', error && 'opacity-25')}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between pl-[46px] font-mono text-[10px]">
                <span className={cx(isPlaying ? 'text-ember-300' : 'text-parchment-400')}>
                    {engaged ? formatSeconds(currentTime) : ''}
                </span>
                <span className="text-parchment-400">{duration != null ? formatSeconds(duration) : ''}</span>
            </div>
        </div>
    )
}
