/**
 * AudioWavePlayer — the Reverie audio play bar: a circular play/pause control
 * (ThemeSongButton's visual language) beside a waveform seek strip, with a
 * mono time readout underneath. A view of the global playlist player: playing
 * or seeking routes the track through the app-wide queue (so it keeps playing
 * in the floating dock after navigation), and the built-in add button queues
 * it without interrupting what's playing. Idle rows show dim deterministic
 * pseudo-peaks (seeded per track); the real decoded waveform binds in while
 * the row is the current track.
 */

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Download, ListMusic, Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { cx, Icon, IconButton } from '@/ui/primitives'
import { pseudoPeaks } from './audioData'
import { downloadThemeSong } from './downloadThemeSong'
import { formatSeconds } from './formatSeconds'
import { WaveformSeekBar } from './WaveformSeekBar'

export interface AudioWavePlayerProps {
    /** Resolved (absolute) audio URL. */
    src: string
    /** Track name for accessible labels and the playlist dock. */
    title?: string
    /** Duration shown before metadata loads. */
    durationMs?: number | null
    /** Seed for the dormant pseudo-waveform; defaults to `src`. */
    peakSeed?: string
    /** Card identity/artwork carried into the playlist dock. */
    trackMeta?: Pick<PlaylistTrack, 'cardName' | 'cardType' | 'cardId' | 'artworkUrl'>
    /** Show the add-to-playlist button. */
    showEnqueue?: boolean
    /** Show the download button. */
    showDownload?: boolean
    /** Lets the host card mirror the playing state (glow, action visibility). */
    onPlayingChange?: (playing: boolean) => void
    className?: string
}

export function AudioWavePlayer({
    src,
    title,
    durationMs,
    peakSeed,
    trackMeta,
    showEnqueue = true,
    showDownload = true,
    onPlayingChange,
    className,
}: AudioWavePlayerProps) {
    const playlist = usePlaylist()
    const [downloadState, setDownloadState] = useState<{
        src: string
        downloading: boolean
        error: boolean
    } | null>(null)
    const track = useMemo(
        () => themeTrack({ url: src, title, durationMs, ...trackMeta }),
        [src, title, durationMs, trackMeta],
    )
    const activeDownloadState = downloadState?.src === src ? downloadState : null
    const downloading = Boolean(activeDownloadState?.downloading)
    const downloadError = Boolean(activeDownloadState?.error)

    // This row binds the global player's state only while it's the current
    // track; otherwise it renders dormant and any interaction promotes it.
    const isCurrent = playlist.currentTrack?.id === src
    const isPlaying = isCurrent && playlist.isPlaying
    const isLoading = isCurrent && playlist.isLoading
    const error = isCurrent ? playlist.error : null
    const currentTime = isCurrent ? playlist.currentTime : 0
    const fallbackDuration = durationMs && durationMs > 0 ? durationMs / 1000 : null
    const duration = (isCurrent ? playlist.duration : null) ?? fallbackDuration
    const queued = playlist.isQueued(src)

    const placeholder = useMemo(() => pseudoPeaks(peakSeed ?? src), [peakSeed, src])
    const peaks = (isCurrent ? playlist.peaks : null) ?? placeholder

    const engaged = isPlaying || currentTime > 0
    const progress = duration && duration > 0 ? currentTime / duration : 0
    const trackName = title?.trim() || 'theme'

    // Mirror the authoritative play state to the host (card glow). Driven by the
    // media events, so a pause forced by another player's audio focus syncs too.
    useEffect(() => {
        onPlayingChange?.(isPlaying)
    }, [isPlaying, onPlayingChange])

    const toggle = (e: MouseEvent) => {
        // Never let the control trigger an enclosing clickable card.
        e.stopPropagation()
        e.preventDefault()
        playlist.playNow(track)
    }

    const seekRatio = (ratio: number) => {
        if (isCurrent) playlist.seekRatio(ratio)
        else playlist.playNow(track, { seekRatio: ratio })
    }

    const enqueue = (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        playlist.enqueue(track)
    }

    const download = (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (downloading) return
        const requestSrc = src
        setDownloadState({ src: requestSrc, downloading: true, error: false })
        void downloadThemeSong({ url: src, title: track.title })
            .then(() => {
                setDownloadState((state) => (state?.src === requestSrc ? null : state))
            })
            .catch(() => {
                setDownloadState((state) =>
                    state?.src === requestSrc ? { src: requestSrc, downloading: false, error: true } : state,
                )
            })
    }

    return (
        <div className={cx('flex min-w-0 flex-col gap-1', className)} data-testid="audio-wave-player">
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    aria-label={error ? `Retry ${trackName}` : isPlaying ? `Pause ${trackName}` : `Play ${trackName}`}
                    aria-pressed={isPlaying}
                    title={error ?? (isPlaying ? 'Pause theme' : 'Play theme')}
                    disabled={isLoading}
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
                        isLoading && 'cursor-wait opacity-80',
                    )}
                >
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <Icon icon={error ? RotateCcw : isPlaying ? Pause : Play} size={16} />
                    )}
                </button>

                <div className="relative min-w-0 flex-1">
                    <WaveformSeekBar
                        peaks={peaks}
                        progress={progress}
                        currentTime={currentTime}
                        duration={duration}
                        onSeekRatio={seekRatio}
                        engaged={engaged}
                        disabled={Boolean(error)}
                        label={`Seek within ${trackName}`}
                        className={cx(!engaged && 'opacity-70', error && 'opacity-25')}
                    />
                    {isLoading && (
                        // The arcane shimmer sweep (same keyframe as image loading) —
                        // transparent so the dormant bars stay visible underneath.
                        <div
                            className="pointer-events-none absolute inset-0 animate-shimmer rounded-sm bg-[linear-gradient(100deg,transparent_30%,rgba(143,111,227,0.22)_50%,transparent_70%)] bg-no-repeat [background-size:200%_100%]"
                            aria-hidden="true"
                            data-testid="waveform-loading"
                        />
                    )}
                </div>

                {showEnqueue && (
                    <IconButton
                        label={queued ? `${trackName} is in the playlist` : `Add ${trackName} to playlist`}
                        size="sm"
                        tone={queued ? 'active' : 'default'}
                        className="h-7 w-7"
                        disabled={queued}
                        onClick={enqueue}
                    >
                        <ListMusic size={14} />
                    </IconButton>
                )}
                {showDownload && (
                    <IconButton
                        label={
                            downloadError
                                ? `Retry download ${trackName}`
                                : downloading
                                  ? `Downloading ${trackName}`
                                  : `Download ${trackName}`
                        }
                        size="sm"
                        tone={downloadError ? 'danger' : 'default'}
                        className="h-7 w-7"
                        disabled={downloading}
                        onClick={download}
                    >
                        {downloading ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Download size={14} strokeWidth={1.75} />
                        )}
                    </IconButton>
                )}
            </div>

            <div
                className={cx(
                    'flex items-center justify-between pl-[46px] font-mono text-[10px]',
                    showEnqueue && showDownload ? 'pr-[74px]' : (showEnqueue || showDownload) && 'pr-[38px]',
                )}
            >
                <span className={cx(isPlaying ? 'text-ember-300' : 'text-parchment-400')}>
                    {engaged ? formatSeconds(currentTime) : ''}
                </span>
                {error ? (
                    <span className="text-blood-500">{error}</span>
                ) : (
                    <span className="text-parchment-400">{duration != null ? formatSeconds(duration) : ''}</span>
                )}
            </div>
        </div>
    )
}
