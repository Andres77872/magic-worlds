/**
 * PlaylistDock — the floating, persistent mini music player. Renders nothing
 * until the playlist has tracks, then docks bottom-right (Toast's portal
 * pattern) and survives page navigation since it mounts at the AppRouter
 * shell. The collapsed bar shows the current track with transport controls
 * and a waveform seek strip; the queue panel expands above/below it with
 * per-row jump/remove plus Stop (keep queue) and Clear (close the player).
 */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
    ChevronDown,
    ChevronUp,
    Download,
    GripVertical,
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
import type { PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { AuthenticatedImage, Button, cx, Eyebrow, Icon, IconButton } from '@/ui/primitives'
import { pseudoPeaks } from './audioData'
import { downloadThemeSong } from './downloadThemeSong'
import { formatSeconds } from './formatSeconds'
import { WaveformSeekBar } from './WaveformSeekBar'

export interface PlaylistDockCardTarget {
    type: NonNullable<PlaylistTrack['cardType']>
    id: string
    fallbackName?: string
}

export interface PlaylistDockProps {
    onOpenCard?: (target: PlaylistDockCardTarget) => void
}

interface DockPosition {
    x: number
    y: number
}

interface DockSize {
    width: number
    height: number
}

const DOCK_POSITION_STORAGE_KEY = 'magic_worlds:playlist_dock_position:v1'
const DOCK_VIEWPORT_PADDING = 16
const DOCK_DEFAULT_SIZE: DockSize = { width: 416, height: 112 }

function readDockPosition(): DockPosition | null {
    if (typeof window === 'undefined') return null
    try {
        const parsed = JSON.parse(window.localStorage.getItem(DOCK_POSITION_STORAGE_KEY) || 'null') as Partial<DockPosition> | null
        if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
        return { x: Number(parsed.x), y: Number(parsed.y) }
    } catch {
        return null
    }
}

function saveDockPosition(position: DockPosition): void {
    try {
        window.localStorage.setItem(DOCK_POSITION_STORAGE_KEY, JSON.stringify(position))
    } catch {
        /* Position persistence is a convenience; playback should never depend on it. */
    }
}

function samePosition(a: DockPosition, b: DockPosition): boolean {
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y)
}

function clampDockPosition(position: DockPosition, size: DockSize): DockPosition {
    if (typeof window === 'undefined') return position
    const minX = DOCK_VIEWPORT_PADDING
    const minY = DOCK_VIEWPORT_PADDING
    const maxX = Math.max(minX, window.innerWidth - size.width - DOCK_VIEWPORT_PADDING)
    const maxY = Math.max(minY, window.innerHeight - size.height - DOCK_VIEWPORT_PADDING)
    return {
        x: Math.min(Math.max(position.x, minX), maxX),
        y: Math.min(Math.max(position.y, minY), maxY),
    }
}

function dockSizeFrom(element: HTMLElement | null): DockSize {
    if (!element) return DOCK_DEFAULT_SIZE
    const rect = element.getBoundingClientRect()
    return {
        width: rect.width || DOCK_DEFAULT_SIZE.width,
        height: rect.height || DOCK_DEFAULT_SIZE.height,
    }
}

export function PlaylistDock({ onOpenCard }: PlaylistDockProps) {
    const playlist = usePlaylist()
    const [queueOpen, setQueueOpen] = useState(false)
    const [queuePlacement, setQueuePlacement] = useState<'above' | 'below'>('above')
    const [queueMaxHeight, setQueueMaxHeight] = useState(288)
    const [position, setPosition] = useState<DockPosition | null>(() => readDockPosition())
    const [dragging, setDragging] = useState(false)
    const [downloadState, setDownloadState] = useState<{
        trackId: string
        downloading: boolean
        error: boolean
    } | null>(null)
    const dockRef = useRef<HTMLElement>(null)
    const positionRef = useRef<DockPosition | null>(position)
    const dragRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        origin: DockPosition
        size: DockSize
    } | null>(null)

    useEffect(() => {
        positionRef.current = position
    }, [position])

    const clampCurrentPosition = useCallback(() => {
        const current = positionRef.current
        if (!current) return
        const next = clampDockPosition(current, dockSizeFrom(dockRef.current))
        if (samePosition(current, next)) return
        positionRef.current = next
        setPosition(next)
        saveDockPosition(next)
    }, [])

    useEffect(() => {
        if (!position) return
        const frame = window.requestAnimationFrame(clampCurrentPosition)
        return () => window.cancelAnimationFrame(frame)
    }, [position, queueOpen, clampCurrentPosition])

    useEffect(() => {
        if (!position) return undefined
        const handleResize = () => clampCurrentPosition()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [position, clampCurrentPosition])

    const updateQueueMetrics = useCallback(() => {
        const rect = dockRef.current?.getBoundingClientRect()
        if (!rect) return
        const gap = 8
        const spaceAbove = rect.top - DOCK_VIEWPORT_PADDING - gap
        const spaceBelow = window.innerHeight - rect.bottom - DOCK_VIEWPORT_PADDING - gap
        const nextPlacement = spaceAbove >= 180 || spaceAbove >= spaceBelow ? 'above' : 'below'
        const available = nextPlacement === 'above' ? spaceAbove : spaceBelow
        setQueuePlacement(nextPlacement)
        setQueueMaxHeight(Math.max(96, Math.min(288, available)))
    }, [])

    useEffect(() => {
        if (!queueOpen) return undefined
        updateQueueMetrics()
        window.addEventListener('resize', updateQueueMetrics)
        return () => window.removeEventListener('resize', updateQueueMetrics)
    }, [queueOpen, position, playlist.queue.length, updateQueueMetrics])

    const startDrag = (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return
        const rect = dockRef.current?.getBoundingClientRect()
        if (!rect) return
        e.preventDefault()
        e.stopPropagation()
        const size = { width: rect.width, height: rect.height }
        const origin = positionRef.current ?? { x: rect.left, y: rect.top }
        const nextOrigin = clampDockPosition(origin, size)
        positionRef.current = nextOrigin
        setPosition(nextOrigin)
        setDragging(true)
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origin: nextOrigin,
            size,
        }
        e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.preventDefault()
        const next = clampDockPosition(
            {
                x: drag.origin.x + e.clientX - drag.startX,
                y: drag.origin.y + e.clientY - drag.startY,
            },
            drag.size,
        )
        positionRef.current = next
        setPosition(next)
    }

    const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.preventDefault()
        dragRef.current = null
        setDragging(false)
        if (positionRef.current) saveDockPosition(positionRef.current)
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId)
    }

    const nudgeDock = (e: KeyboardEvent<HTMLButtonElement>) => {
        const delta = e.shiftKey ? 64 : 16
        const direction: Partial<Record<string, DockPosition>> = {
            ArrowLeft: { x: -delta, y: 0 },
            ArrowRight: { x: delta, y: 0 },
            ArrowUp: { x: 0, y: -delta },
            ArrowDown: { x: 0, y: delta },
        }
        const move = direction[e.key]
        if (!move) return
        const rect = dockRef.current?.getBoundingClientRect()
        if (!rect) return
        e.preventDefault()
        e.stopPropagation()
        const size = { width: rect.width, height: rect.height }
        const origin = positionRef.current ?? { x: rect.left, y: rect.top }
        const next = clampDockPosition({ x: origin.x + move.x, y: origin.y + move.y }, size)
        positionRef.current = next
        setPosition(next)
        saveDockPosition(next)
    }

    const { currentTrack } = playlist
    if (playlist.queue.length === 0 || !currentTrack || typeof document === 'undefined') return null

    const engaged = playlist.isPlaying || playlist.currentTime > 0
    const progress =
        playlist.duration && playlist.duration > 0 ? playlist.currentTime / playlist.duration : 0
    const peaks = playlist.peaks ?? pseudoPeaks(currentTrack.id)
    const atQueueEnd = playlist.currentIndex >= playlist.queue.length - 1
    const hasCardTarget = Boolean(onOpenCard && currentTrack.cardType && currentTrack.cardId)
    const currentCardLabel = currentTrack.cardName || currentTrack.title
    const activeDownloadState = downloadState?.trackId === currentTrack.id ? downloadState : null
    const downloading = Boolean(activeDownloadState?.downloading)
    const downloadError = Boolean(activeDownloadState?.error)
    const customPosition = position !== null
    const wrapperStyle: CSSProperties | undefined = customPosition
        ? { left: position.x, top: position.y, width: 'min(calc(100vw - 2rem), 26rem)' }
        : undefined

    const openCurrentCard = () => {
        if (!onOpenCard || !currentTrack.cardType || !currentTrack.cardId) return
        onOpenCard({
            type: currentTrack.cardType,
            id: currentTrack.cardId,
            fallbackName: currentCardLabel,
        })
    }

    const downloadCurrentTrack = () => {
        if (downloading) return
        const requestTrackId = currentTrack.id
        setDownloadState({ trackId: requestTrackId, downloading: true, error: false })
        void downloadThemeSong({ url: currentTrack.url, title: currentTrack.title, fallbackName: currentTrack.cardName })
            .then(() => {
                setDownloadState((state) => (state?.trackId === requestTrackId ? null : state))
            })
            .catch(() => {
                setDownloadState((state) =>
                    state?.trackId === requestTrackId
                        ? { trackId: requestTrackId, downloading: false, error: true }
                        : state,
                )
            })
    }

    const artwork = currentTrack.artworkUrl ? (
        <AuthenticatedImage src={currentTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
    ) : (
        <span className="flex h-full w-full items-center justify-center text-ember-400/80">
            <Icon icon={Music} size={15} />
        </span>
    )

    return createPortal(
        <div
            className={cx(
                'pointer-events-none fixed z-[45]',
                customPosition
                    ? 'left-0 top-0'
                    : 'inset-x-4 bottom-4 flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5',
            )}
            style={wrapperStyle}
        >
            <section
                ref={dockRef}
                aria-label="Now playing"
                className={cx(
                    'pointer-events-auto relative flex w-full max-w-[min(calc(100vw-2rem),26rem)] flex-col rounded-lg border bg-ink-800/95 ring-1 ring-ink-900/60 backdrop-blur-md',
                    'transition-all motion-reduce:transition-none',
                    playlist.isPlaying ? 'border-ember-500/40 shadow-glow-ember' : 'border-parchment-50/10 shadow-xl',
                    dragging && 'select-none border-ember-500/55 shadow-card-hover',
                )}
            >
                {queueOpen && (
                    <div
                        className={cx(
                            'absolute left-0 right-0 z-10 overflow-hidden rounded-lg border border-parchment-50/10 bg-ink-800/95 shadow-xl ring-1 ring-ink-900/70 backdrop-blur-md',
                            queuePlacement === 'above' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]',
                        )}
                    >
                        <ul className="overflow-y-auto py-1" style={{ maxHeight: queueMaxHeight }}>
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
                        {hasCardTarget ? (
                            <button
                                type="button"
                                aria-label={`Open card ${currentCardLabel}`}
                                title={`Open ${currentCardLabel}`}
                                onClick={openCurrentCard}
                                className="h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-parchment-50/10 bg-ink-700 transition-all hover:border-ember-500/45 hover:shadow-glow-ember"
                            >
                                {artwork}
                            </button>
                        ) : (
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-parchment-50/10 bg-ink-700">
                                {artwork}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-ui text-[13px] font-semibold leading-snug text-parchment-50">
                                {currentTrack.title}
                            </p>
                            {currentTrack.cardName && (
                                hasCardTarget ? (
                                    <button
                                        type="button"
                                        onClick={openCurrentCard}
                                        className="block max-w-full cursor-pointer truncate text-left text-[11px] text-parchment-400 underline-offset-2 transition-colors hover:text-ember-300 hover:underline"
                                    >
                                        {currentTrack.cardName}
                                    </button>
                                ) : (
                                    <p className="truncate text-[11px] text-parchment-400">{currentTrack.cardName}</p>
                                )
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                            <button
                                type="button"
                                aria-label="Drag player"
                                title="Drag player"
                                onPointerDown={startDrag}
                                onPointerMove={moveDrag}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                                onKeyDown={nudgeDock}
                                className={cx(
                                    'inline-flex h-7 w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-parchment-300 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50',
                                    dragging && 'cursor-grabbing bg-ember-500/15 text-ember-300',
                                )}
                            >
                                <GripVertical size={14} />
                            </button>
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
                                label={
                                    downloadError
                                        ? `Retry download ${currentTrack.title}`
                                        : downloading
                                          ? `Downloading ${currentTrack.title}`
                                          : `Download ${currentTrack.title}`
                                }
                                size="sm"
                                tone={downloadError ? 'danger' : 'default'}
                                className="h-7 w-7"
                                disabled={downloading}
                                onClick={downloadCurrentTrack}
                            >
                                {downloading ? (
                                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <Download size={14} strokeWidth={1.75} />
                                )}
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
