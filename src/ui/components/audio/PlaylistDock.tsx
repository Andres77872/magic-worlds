/**
 * PlaylistDock — the floating, persistent mini music player. Renders nothing
 * until the playlist has tracks, then docks bottom-right (Toast's portal
 * pattern) and survives page navigation since it mounts at the AppRouter
 * shell. The collapsed bar shows the current track with transport controls
 * and a waveform seek strip; the queue panel expands above it with per-row
 * jump/remove plus Stop (keep queue) and Clear (close the player).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
    ChevronDown,
    ChevronUp,
    ListMusic,
    Loader2,
    Music,
    Pause,
    Play,
    RotateCcw,
    SkipBack,
    SkipForward,
    Square,
    Trash2,
    X,
} from 'lucide-react'
import { usePlaylist } from '@/app/hooks'
import { Button, cx, Eyebrow, Icon, IconButton } from '@/ui/primitives'
import { pseudoPeaks } from './audioData'
import { formatSeconds } from './formatSeconds'
import { WaveformSeekBar } from './WaveformSeekBar'

export function PlaylistDock() {
    const playlist = usePlaylist()
    const [queueOpen, setQueueOpen] = useState(false)

    const { currentTrack } = playlist
    if (playlist.queue.length === 0 || !currentTrack || typeof document === 'undefined') return null

    const engaged = playlist.isPlaying || playlist.currentTime > 0
    const progress =
        playlist.duration && playlist.duration > 0 ? playlist.currentTime / playlist.duration : 0
    const peaks = playlist.peaks ?? pseudoPeaks(currentTrack.id)
    const atQueueEnd = playlist.currentIndex >= playlist.queue.length - 1

    return createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[45] flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5">
            <section
                aria-label="Now playing"
                className={cx(
                    'pointer-events-auto flex w-full max-w-[min(calc(100vw-2rem),26rem)] flex-col overflow-hidden rounded-lg border bg-ink-800/95 ring-1 ring-ink-900/60 backdrop-blur-md',
                    'transition-all motion-reduce:transition-none',
                    playlist.isPlaying ? 'border-ember-500/40 shadow-glow-ember' : 'border-parchment-50/10 shadow-xl',
                )}
            >
                {queueOpen && (
                    <div className="flex flex-col border-b border-parchment-50/10">
                        <ul className="max-h-72 overflow-y-auto py-1">
                            {playlist.queue.map((track, index) => {
                                const isCurrent = index === playlist.currentIndex
                                return (
                                    <li
                                        key={track.id}
                                        className={cx(
                                            'flex items-center gap-1 pr-2 transition-colors',
                                            isCurrent ? 'bg-ember-500/10' : 'hover:bg-parchment-50/[.04]',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => playlist.playQueueFrom(index)}
                                            aria-current={isCurrent || undefined}
                                            aria-label={`Play track ${index + 1}: ${track.title}`}
                                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
                                        >
                                            <span className="w-5 shrink-0 text-center font-mono text-[10px] text-parchment-400">
                                                {isCurrent ? (
                                                    <span
                                                        className={cx(
                                                            'mx-auto block h-1.5 w-1.5 rounded-full bg-ember-400',
                                                            playlist.isPlaying && 'animate-pulse',
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    index + 1
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span
                                                    className={cx(
                                                        'block truncate font-ui text-[13px] font-medium leading-snug',
                                                        isCurrent ? 'text-ember-300' : 'text-parchment-100',
                                                    )}
                                                >
                                                    {track.title}
                                                </span>
                                                {track.cardName && (
                                                    <span className="block truncate text-[11px] text-parchment-400">
                                                        {track.cardName}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="shrink-0 font-mono text-[10px] text-parchment-400">
                                                {track.durationMs ? formatSeconds(track.durationMs / 1000) : ''}
                                            </span>
                                        </button>
                                        <IconButton
                                            label={`Remove ${track.title} from playlist`}
                                            size="sm"
                                            tone="danger"
                                            className="h-7 w-7"
                                            onClick={() => playlist.removeAt(index)}
                                        >
                                            <X size={13} />
                                        </IconButton>
                                    </li>
                                )
                            })}
                        </ul>
                        <div className="flex items-center justify-between border-t border-parchment-50/10 py-1 pl-3 pr-1">
                            <Eyebrow tone="muted" className="text-[10px]">
                                {playlist.queue.length} {playlist.queue.length === 1 ? 'track' : 'tracks'}
                            </Eyebrow>
                            <div className="flex items-center">
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    iconLeft={<Icon icon={Square} size={13} />}
                                    onClick={playlist.stop}
                                >
                                    Stop
                                </Button>
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    iconLeft={<Icon icon={Trash2} size={13} />}
                                    onClick={playlist.clearAndClose}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-1.5 p-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-parchment-50/10 bg-ink-700">
                            {currentTrack.artworkUrl ? (
                                <img src={currentTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-ember-400/80">
                                    <Icon icon={Music} size={15} />
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-ui text-[13px] font-semibold leading-snug text-parchment-50">
                                {currentTrack.title}
                            </p>
                            {currentTrack.cardName && (
                                <p className="truncate text-[11px] text-parchment-400">{currentTrack.cardName}</p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                            <IconButton
                                label="Previous track"
                                size="sm"
                                className="h-7 w-7"
                                onClick={playlist.prev}
                            >
                                <SkipBack size={14} />
                            </IconButton>
                            <button
                                type="button"
                                aria-label={
                                    playlist.error
                                        ? `Retry ${currentTrack.title}`
                                        : playlist.isPlaying
                                          ? `Pause ${currentTrack.title}`
                                          : `Play ${currentTrack.title}`
                                }
                                aria-pressed={playlist.isPlaying}
                                title={playlist.error ?? (playlist.isPlaying ? 'Pause' : 'Play')}
                                disabled={playlist.isLoading}
                                onClick={playlist.toggle}
                                className={cx(
                                    'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                                    playlist.error
                                        ? 'border-blood-500/50 text-blood-500 hover:border-blood-500/70'
                                        : playlist.isPlaying
                                          ? 'border-ember-500/60 bg-ink-900/60 text-ember-300 shadow-glow-ember'
                                          : cx(
                                                'border-parchment-50/20 bg-ink-900/60 text-parchment-50 hover:bg-ink-900/80',
                                                'hover:border-ember-500/50 hover:text-ember-200 hover:shadow-glow-ember',
                                            ),
                                    playlist.isLoading && 'cursor-wait opacity-80',
                                )}
                            >
                                {playlist.isLoading ? (
                                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <Icon
                                        icon={playlist.error ? RotateCcw : playlist.isPlaying ? Pause : Play}
                                        size={16}
                                    />
                                )}
                            </button>
                            <IconButton
                                label="Next track"
                                size="sm"
                                className="h-7 w-7"
                                disabled={atQueueEnd}
                                onClick={playlist.next}
                            >
                                <SkipForward size={14} />
                            </IconButton>
                            <IconButton
                                label={queueOpen ? 'Hide playlist' : 'Show playlist'}
                                size="sm"
                                tone={queueOpen ? 'active' : 'default'}
                                className="relative h-7 w-7"
                                onClick={() => setQueueOpen((open) => !open)}
                            >
                                <ListMusic size={14} />
                                {playlist.queue.length > 1 && (
                                    <span
                                        className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ember-500 px-0.5 font-mono text-[9px] font-bold leading-none text-on-ember ring-2 ring-ink-800"
                                        aria-hidden="true"
                                    >
                                        {playlist.queue.length}
                                    </span>
                                )}
                                <Icon
                                    icon={queueOpen ? ChevronDown : ChevronUp}
                                    size={9}
                                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-parchment-400"
                                />
                            </IconButton>
                            <IconButton
                                label="Close player"
                                size="sm"
                                className="h-7 w-7"
                                onClick={playlist.clearAndClose}
                            >
                                <X size={14} />
                            </IconButton>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className={cx(
                                'w-8 shrink-0 text-right font-mono text-[10px]',
                                playlist.isPlaying ? 'text-ember-300' : 'text-parchment-400',
                            )}
                        >
                            {engaged ? formatSeconds(playlist.currentTime) : ''}
                        </span>
                        <div className="relative min-w-0 flex-1">
                            <WaveformSeekBar
                                peaks={peaks}
                                progress={progress}
                                currentTime={playlist.currentTime}
                                duration={playlist.duration}
                                onSeekRatio={playlist.seekRatio}
                                engaged={engaged}
                                disabled={Boolean(playlist.error)}
                                label={`Seek within ${currentTrack.title}`}
                                className={cx('h-6', !engaged && 'opacity-70', playlist.error && 'opacity-25')}
                            />
                            {playlist.isLoading && (
                                // The arcane shimmer sweep, same as AudioWavePlayer's
                                // loading state — transparent so the bars stay visible.
                                <div
                                    className="pointer-events-none absolute inset-0 animate-shimmer rounded-sm bg-[linear-gradient(100deg,transparent_30%,rgba(143,111,227,0.22)_50%,transparent_70%)] bg-no-repeat [background-size:200%_100%]"
                                    aria-hidden="true"
                                    data-testid="dock-waveform-loading"
                                />
                            )}
                        </div>
                        <span className="w-8 shrink-0 font-mono text-[10px] text-parchment-400">
                            {playlist.error ? '' : playlist.duration != null ? formatSeconds(playlist.duration) : ''}
                        </span>
                    </div>
                    {playlist.error && (
                        <p className="pl-10 font-mono text-[10px] text-blood-500">{playlist.error}</p>
                    )}
                </div>
            </section>
        </div>,
        document.body,
    )
}
