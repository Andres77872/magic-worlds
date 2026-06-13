/**
 * ThemeSongButton — a circular play/pause control overlaid on a card portrait.
 * A view of the global playlist player: clicking sends the card's theme to the
 * app-wide queue (playing immediately), or pauses it when it's already the
 * current track, so the music keeps playing in the floating dock after the
 * card scrolls away or the page changes. Clicks never bubble to an enclosing
 * clickable card (the card's own onClick opens the editor / begins the scene).
 */
import { useState, type MouseEvent } from 'react'
import { Download, Loader2, Pause, Play } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { downloadThemeSong } from '@/ui/components/audio/downloadThemeSong'
import { cx } from './cx'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

export type ThemeSongButtonSize = 'sm' | 'md'

interface ThemeSongButtonProps {
    /** Resolved (absolute) audio URL. */
    src?: string
    /** Song title shown in the player dock; falls back to "<cardName> theme". */
    title?: string
    cardName?: string
    cardType?: PlaylistTrack['cardType']
    cardId?: string
    /** Card portrait shown as the dock thumbnail. */
    artworkUrl?: string
    size?: ThemeSongButtonSize
    showDownload?: boolean
    className?: string
}

const DIM: Record<ThemeSongButtonSize, { box: string; icon: number }> = {
    sm: { box: 'h-8 w-8', icon: 14 },
    md: { box: 'h-9 w-9', icon: 16 },
}

export function ThemeSongButton({
    src,
    title,
    cardName,
    cardType,
    cardId,
    artworkUrl,
    size = 'sm',
    showDownload = true,
    className,
}: ThemeSongButtonProps) {
    const playlist = usePlaylist()
    const [downloadState, setDownloadState] = useState<{
        src: string
        downloading: boolean
        error: boolean
    } | null>(null)
    const isPlaying = Boolean(src) && playlist.currentTrack?.id === src && playlist.isPlaying
    const activeDownloadState = src && downloadState?.src === src ? downloadState : null
    const downloading = Boolean(activeDownloadState?.downloading)
    const downloadError = Boolean(activeDownloadState?.error)
    const downloadName = title?.trim() || (cardName?.trim() ? `${cardName.trim()} theme` : 'theme song')

    const toggle = (e: MouseEvent) => {
        // Never let the play toggle trigger the enclosing clickable card.
        e.stopPropagation()
        e.preventDefault()
        if (!src) return
        playlist.playNow(themeTrack({ url: src, title, cardName, cardType, cardId, artworkUrl }))
    }

    const download = (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (!src || downloading) return
        const requestSrc = src
        setDownloadState({ src: requestSrc, downloading: true, error: false })
        void downloadThemeSong({ url: requestSrc, title, fallbackName: cardName })
            .then(() => {
                setDownloadState((state) => (state?.src === requestSrc ? null : state))
            })
            .catch(() => {
                setDownloadState((state) =>
                    state?.src === requestSrc ? { src: requestSrc, downloading: false, error: true } : state,
                )
            })
    }

    const dim = DIM[size]
    return (
        <>
            <button
                type="button"
                aria-label={isPlaying ? 'Pause theme song' : 'Play theme song'}
                aria-pressed={isPlaying}
                title={isPlaying ? 'Pause theme' : 'Play theme'}
                onClick={toggle}
                className={cx(
                    'inline-flex shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                    'border-parchment-50/20 bg-ink-900/60 text-parchment-50 hover:bg-ink-900/80',
                    isPlaying
                        ? 'border-ember-500/60 text-ember-300 shadow-glow-ember'
                        : 'hover:border-ember-500/50 hover:text-ember-200 hover:shadow-glow-ember',
                    dim.box,
                    className,
                )}
            >
                <Icon icon={isPlaying ? Pause : Play} size={dim.icon} />
            </button>
            {showDownload && src && (
                <IconButton
                    label={
                        downloadError
                            ? `Retry download ${downloadName}`
                            : downloading
                              ? `Downloading ${downloadName}`
                              : `Download ${downloadName}`
                    }
                    size="sm"
                    tone={downloadError ? 'danger' : 'default'}
                    className={cx(
                        'rounded-full border border-parchment-50/20 bg-ink-900/60 text-parchment-50 backdrop-blur-sm hover:bg-ink-900/80',
                        size === 'md' ? 'h-9 w-9' : 'h-8 w-8',
                    )}
                    disabled={downloading}
                    onClick={download}
                >
                    {downloading ? (
                        <Loader2 size={dim.icon - 1} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <Download size={dim.icon - 1} strokeWidth={1.75} />
                    )}
                </IconButton>
            )}
        </>
    )
}
