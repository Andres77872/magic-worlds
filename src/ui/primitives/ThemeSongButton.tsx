/**
 * ThemeSongButton — a circular play/pause control overlaid on a card portrait.
 * A view of the global playlist player: clicking sends the card's theme to the
 * app-wide queue (playing immediately), or pauses it when it's already the
 * current track, so the music keeps playing in the floating dock after the
 * card scrolls away or the page changes. Clicks never bubble to an enclosing
 * clickable card (the card's own onClick opens the editor / begins the scene).
 */
import type { MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack, type PlaylistTrack } from '@/app/providers/audioPlaylistContext'
import { cx } from './cx'
import { Icon } from './Icon'

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
    className,
}: ThemeSongButtonProps) {
    const playlist = usePlaylist()
    const isPlaying = Boolean(src) && playlist.currentTrack?.id === src && playlist.isPlaying

    const toggle = (e: MouseEvent) => {
        // Never let the play toggle trigger the enclosing clickable card.
        e.stopPropagation()
        e.preventDefault()
        if (!src) return
        playlist.playNow(themeTrack({ url: src, title, cardName, cardType, cardId, artworkUrl }))
    }

    const dim = DIM[size]
    return (
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
    )
}
