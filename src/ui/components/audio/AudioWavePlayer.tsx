/**
 * AudioWavePlayer — the Reverie audio play bar: a circular play/pause control
 * (ThemeSongButton's visual language) beside a waveform seek strip, with a
 * mono time readout underneath. Idle cards show dim deterministic pseudo-peaks
 * (seeded per track); the real decoded waveform morphs in on first play. The
 * audio bytes are fetched once and shared with the download action's cache.
 */

import { useEffect, useMemo, type MouseEvent } from 'react'
import { Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { cx, Icon } from '@/ui/primitives'
import { pseudoPeaks } from './audioData'
import { formatSeconds } from './formatSeconds'
import { useAudioPlayer } from './useAudioPlayer'
import { WaveformSeekBar } from './WaveformSeekBar'

export interface AudioWavePlayerProps {
    /** Resolved (absolute) audio URL. */
    src: string
    /** Track name for accessible labels. */
    title?: string
    /** Duration shown before metadata loads. */
    durationMs?: number | null
    /** Seed for the dormant pseudo-waveform; defaults to `src`. */
    peakSeed?: string
    /** Lets the host card mirror the playing state (glow, action visibility). */
    onPlayingChange?: (playing: boolean) => void
    className?: string
}

export function AudioWavePlayer({
    src,
    title,
    durationMs,
    peakSeed,
    onPlayingChange,
    className,
}: AudioWavePlayerProps) {
    const player = useAudioPlayer(src, { fallbackDurationMs: durationMs })
    const placeholder = useMemo(() => pseudoPeaks(peakSeed ?? src), [peakSeed, src])
    const peaks = player.peaks ?? placeholder

    const engaged = player.isPlaying || player.currentTime > 0
    const progress = player.duration && player.duration > 0 ? player.currentTime / player.duration : 0
    const trackName = title?.trim() || 'theme'

    // Mirror the authoritative play state to the host (card glow). Driven by the
    // media events, so a pause forced by another player's audio focus syncs too.
    const isPlaying = player.isPlaying
    useEffect(() => {
        onPlayingChange?.(isPlaying)
    }, [isPlaying, onPlayingChange])

    const toggle = (e: MouseEvent) => {
        // Never let the control trigger an enclosing clickable card.
        e.stopPropagation()
        e.preventDefault()
        player.toggle()
    }

    return (
        <div className={cx('flex min-w-0 flex-col gap-1', className)} data-testid="audio-wave-player">
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    aria-label={player.error ? `Retry ${trackName}` : player.isPlaying ? `Pause ${trackName}` : `Play ${trackName}`}
                    aria-pressed={player.isPlaying}
                    title={player.error ?? (player.isPlaying ? 'Pause theme' : 'Play theme')}
                    disabled={player.isLoading}
                    onClick={toggle}
                    className={cx(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                        player.error
                            ? 'border-blood-500/50 text-blood-500 hover:border-blood-500/70'
                            : player.isPlaying
                              ? 'border-ember-500/60 bg-ink-900/60 text-ember-300 shadow-glow-ember'
                              : cx(
                                    'border-parchment-50/20 bg-ink-900/60 text-parchment-50 hover:bg-ink-900/80',
                                    'hover:border-ember-500/50 hover:text-ember-200 hover:shadow-glow-ember',
                                    engaged && 'border-ember-500/40 text-ember-200',
                                ),
                        player.isLoading && 'cursor-wait opacity-80',
                    )}
                >
                    {player.isLoading ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <Icon icon={player.error ? RotateCcw : player.isPlaying ? Pause : Play} size={16} />
                    )}
                </button>

                <div className="relative min-w-0 flex-1">
                    <WaveformSeekBar
                        peaks={peaks}
                        progress={progress}
                        currentTime={player.currentTime}
                        duration={player.duration}
                        onSeekRatio={player.seekRatio}
                        engaged={engaged}
                        disabled={Boolean(player.error)}
                        label={`Seek within ${trackName}`}
                        className={cx(!engaged && 'opacity-70', player.error && 'opacity-25')}
                    />
                    {player.isLoading && (
                        // The arcane shimmer sweep (same keyframe as image loading) —
                        // transparent so the dormant bars stay visible underneath.
                        <div
                            className="pointer-events-none absolute inset-0 animate-shimmer rounded-sm bg-[linear-gradient(100deg,transparent_30%,rgba(143,111,227,0.22)_50%,transparent_70%)] bg-no-repeat [background-size:200%_100%]"
                            aria-hidden="true"
                            data-testid="waveform-loading"
                        />
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pl-[46px] font-mono text-[10px]">
                <span className={cx(player.isPlaying ? 'text-ember-300' : 'text-parchment-400')}>
                    {engaged ? formatSeconds(player.currentTime) : ''}
                </span>
                {player.error ? (
                    <span className="text-blood-500">{player.error}</span>
                ) : (
                    <span className="text-parchment-400">
                        {player.duration != null ? formatSeconds(player.duration) : ''}
                    </span>
                )}
            </div>
        </div>
    )
}
