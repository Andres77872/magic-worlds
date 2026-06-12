import { createContext } from 'react'
import type { CardMediaTargetType } from '@/shared'

/**
 * One entry in the global theme-song playlist. Identity (and dedupe) key is
 * the resolved absolute audio URL — cards only know `theme_song_url` while
 * media items know `asset_id` + url, and both point at the same
 * `/generated-audio/{asset}.mp3` file, so URL keying unifies every entry point.
 */
export interface PlaylistTrack {
    /** Identity/dedupe key — the resolved absolute audio URL. */
    id: string
    url: string
    /** Song title (lyrics) or a "<Card name> theme" fallback. */
    title: string
    cardName?: string
    cardType?: CardMediaTargetType | 'persona'
    cardId?: string
    /** Card portrait for the player dock thumbnail. */
    artworkUrl?: string
    durationMs?: number | null
}

export interface AudioPlaylistContextValue {
    queue: PlaylistTrack[]
    /** -1 when the queue is empty. */
    currentIndex: number
    currentTrack: PlaylistTrack | null
    isPlaying: boolean
    /** True while the current track's bytes are being fetched. */
    isLoading: boolean
    /** Playback error for the current track, if any. */
    error: string | null
    /** Seconds, `timeupdate`-driven. */
    currentTime: number
    /** Seconds from metadata, else the track's known duration, else null. */
    duration: number | null
    /** Decoded waveform peaks for the current track; null → pseudo-peaks. */
    peaks: number[] | null
    /**
     * Play a track immediately: the current track toggles pause, a queued
     * track is jumped to, a new track is inserted after the current one.
     */
    playNow: (track: PlaylistTrack, opts?: { seekRatio?: number }) => void
    /** Append to the queue (deduped by id) without starting playback. */
    enqueue: (track: PlaylistTrack) => void
    playQueueFrom: (index: number) => void
    toggle: () => void
    next: () => void
    /** Restarts the track when >3s in, otherwise steps back. */
    prev: () => void
    /** Pause and rewind to the start; the queue is kept. */
    stop: () => void
    removeAt: (index: number) => void
    /** Stop playback, empty the queue and hide the dock. */
    clearAndClose: () => void
    /** Seek to a 0..1 position; while idle this starts playback from there. */
    seekRatio: (ratio: number) => void
    isQueued: (id: string) => boolean
}

export const AudioPlaylistContext = createContext<AudioPlaylistContextValue | undefined>(undefined)

/** Builds a playlist track from card/media fields; `url` must be resolved. */
export function themeTrack(args: {
    url: string
    title?: string | null
    cardName?: string | null
    cardType?: PlaylistTrack['cardType']
    cardId?: string | null
    artworkUrl?: string | null
    durationMs?: number | null
}): PlaylistTrack {
    const cardName = args.cardName?.trim() || undefined
    return {
        id: args.url,
        url: args.url,
        title: args.title?.trim() || (cardName ? `${cardName} theme` : 'Theme song'),
        cardName,
        cardType: args.cardType,
        cardId: args.cardId ?? undefined,
        artworkUrl: args.artworkUrl?.trim() || undefined,
        durationMs: args.durationMs ?? undefined,
    }
}
