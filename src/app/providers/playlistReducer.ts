/**
 * Pure queue state for the global theme-song playlist. Playback side effects
 * live in AudioPlaylistProvider; this module only decides what the queue looks
 * like and *when playback intent fires* — `playEpoch` increments on every
 * action that should (re)start the current track, so the provider's engine
 * effect can key off `currentTrack.id + playEpoch` alone. Track changes that
 * arrive without an epoch bump (enqueue into an empty queue, removing the
 * playing row) load the new current track paused.
 */

import type { PlaylistLoopMode, PlaylistTrack } from './audioPlaylistContext'

export const PLAYLIST_STORAGE_KEY = 'magic_worlds:playlist:v1'

const LOOP_MODE_ORDER: PlaylistLoopMode[] = ['off', 'track', 'queue']

export interface PlaylistQueueState {
    queue: PlaylistTrack[]
    /** -1 when the queue is empty. */
    currentIndex: number
    /** Monotonic play-intent counter (reset only by CLEAR). */
    playEpoch: number
    loopMode: PlaylistLoopMode
}

export type PlaylistAction =
    | { type: 'PLAY_NOW'; track: PlaylistTrack }
    | { type: 'ENQUEUE'; track: PlaylistTrack }
    | { type: 'PLAY_AT'; index: number }
    | { type: 'NEXT' }
    | { type: 'PREV' }
    | { type: 'REMOVE_AT'; index: number }
    | { type: 'CYCLE_LOOP_MODE' }
    | { type: 'CLEAR' }

export const EMPTY_PLAYLIST_STATE: PlaylistQueueState = { queue: [], currentIndex: -1, playEpoch: 0, loopMode: 'off' }

function fallbackTitle(track: PlaylistTrack): string {
    return track.cardName ? `${track.cardName} theme` : 'Theme song'
}

function isFallbackTitle(track: PlaylistTrack): boolean {
    return track.title === 'Theme song' || track.title === fallbackTitle(track)
}

function mergeTrackMetadata(existing: PlaylistTrack, incoming: PlaylistTrack): PlaylistTrack {
    const merged: PlaylistTrack = {
        ...existing,
        title: !isFallbackTitle(incoming) || isFallbackTitle(existing) ? incoming.title : existing.title,
        cardName: incoming.cardName ?? existing.cardName,
        cardType: incoming.cardType ?? existing.cardType,
        cardId: incoming.cardId ?? existing.cardId,
        artworkUrl: incoming.artworkUrl ?? existing.artworkUrl,
        durationMs: incoming.durationMs ?? existing.durationMs,
    }
    return Object.keys(merged).every(
        (key) => merged[key as keyof PlaylistTrack] === existing[key as keyof PlaylistTrack],
    )
        ? existing
        : merged
}

function replaceTrack(queue: PlaylistTrack[], index: number, track: PlaylistTrack): PlaylistTrack[] {
    if (queue[index] === track) return queue
    const next = queue.slice()
    next[index] = track
    return next
}

export function playlistReducer(state: PlaylistQueueState, action: PlaylistAction): PlaylistQueueState {
    switch (action.type) {
        case 'PLAY_NOW': {
            // The same-track toggle short-circuits in the provider; here the
            // track is either queued elsewhere (jump) or new (insert after the
            // current one so the rest of the queue is preserved).
            const existing = state.queue.findIndex((track) => track.id === action.track.id)
            if (existing >= 0) {
                const queue = replaceTrack(
                    state.queue,
                    existing,
                    mergeTrackMetadata(state.queue[existing], action.track),
                )
                return { ...state, queue, currentIndex: existing, playEpoch: state.playEpoch + 1 }
            }
            const insertAt = state.currentIndex + 1
            const queue = [...state.queue.slice(0, insertAt), action.track, ...state.queue.slice(insertAt)]
            return { queue, currentIndex: insertAt, playEpoch: state.playEpoch + 1, loopMode: state.loopMode }
        }
        case 'ENQUEUE': {
            const existing = state.queue.findIndex((track) => track.id === action.track.id)
            if (existing >= 0) {
                const queue = replaceTrack(
                    state.queue,
                    existing,
                    mergeTrackMetadata(state.queue[existing], action.track),
                )
                return queue === state.queue ? state : { ...state, queue }
            }
            return {
                ...state,
                queue: [...state.queue, action.track],
                // First track of an empty queue becomes current (paused).
                currentIndex: state.currentIndex === -1 ? 0 : state.currentIndex,
            }
        }
        case 'PLAY_AT': {
            if (action.index < 0 || action.index >= state.queue.length) return state
            return { ...state, currentIndex: action.index, playEpoch: state.playEpoch + 1 }
        }
        case 'NEXT': {
            if (state.currentIndex < 0 || state.queue.length === 0) return state
            const atEnd = state.currentIndex >= state.queue.length - 1
            if (atEnd && state.loopMode !== 'queue') return state
            return {
                ...state,
                currentIndex: atEnd ? 0 : state.currentIndex + 1,
                playEpoch: state.playEpoch + 1,
            }
        }
        case 'PREV': {
            if (state.currentIndex < 0 || state.queue.length === 0) return state
            // At the first track this restarts it unless queue loop wraps back.
            const currentIndex =
                state.currentIndex === 0 && state.loopMode === 'queue'
                    ? state.queue.length - 1
                    : Math.max(state.currentIndex - 1, 0)
            return { ...state, currentIndex, playEpoch: state.playEpoch + 1 }
        }
        case 'REMOVE_AT': {
            if (action.index < 0 || action.index >= state.queue.length) return state
            const queue = state.queue.filter((_, i) => i !== action.index)
            let currentIndex = state.currentIndex
            if (queue.length === 0) currentIndex = -1
            else if (action.index < state.currentIndex) currentIndex -= 1
            // Removing the current row points at the following track (clamped)
            // with no epoch bump — it loads paused.
            else if (action.index === state.currentIndex) currentIndex = Math.min(currentIndex, queue.length - 1)
            return { ...state, queue, currentIndex }
        }
        case 'CYCLE_LOOP_MODE': {
            const index = LOOP_MODE_ORDER.indexOf(state.loopMode)
            const loopMode = LOOP_MODE_ORDER[(index + 1) % LOOP_MODE_ORDER.length] ?? 'off'
            return { ...state, loopMode }
        }
        case 'CLEAR':
            return EMPTY_PLAYLIST_STATE
    }
}

function isPlaylistTrack(value: unknown): value is PlaylistTrack {
    if (typeof value !== 'object' || value === null) return false
    const track = value as Record<string, unknown>
    return (
        typeof track.id === 'string' &&
        track.id.length > 0 &&
        typeof track.url === 'string' &&
        typeof track.title === 'string'
    )
}

/** The persisted slice: the queue and position, never play state. */
export function serializePlaylist(state: PlaylistQueueState): string {
    return JSON.stringify({ queue: state.queue, currentIndex: state.currentIndex, loopMode: state.loopMode })
}

function isPlaylistLoopMode(value: unknown): value is PlaylistLoopMode {
    return value === 'off' || value === 'track' || value === 'queue'
}

/** Restore a persisted queue, dropping anything malformed. Always paused. */
export function restorePlaylistState(raw: string | null): PlaylistQueueState {
    if (!raw) return EMPTY_PLAYLIST_STATE
    try {
        const parsed = JSON.parse(raw) as { queue?: unknown; currentIndex?: unknown; loopMode?: unknown }
        const queue = Array.isArray(parsed.queue) ? parsed.queue.filter(isPlaylistTrack) : []
        if (queue.length === 0) return EMPTY_PLAYLIST_STATE
        const index = typeof parsed.currentIndex === 'number' ? Math.trunc(parsed.currentIndex) : 0
        return {
            queue,
            currentIndex: Math.min(Math.max(index, 0), queue.length - 1),
            playEpoch: 0,
            loopMode: isPlaylistLoopMode(parsed.loopMode) ? parsed.loopMode : 'off',
        }
    } catch {
        return EMPTY_PLAYLIST_STATE
    }
}
