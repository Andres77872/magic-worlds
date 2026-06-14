import { describe, expect, it } from 'vitest'
import { themeTrack } from './audioPlaylistContext'
import {
    EMPTY_PLAYLIST_STATE,
    playlistReducer,
    restorePlaylistState,
    serializePlaylist,
    type PlaylistQueueState,
} from './playlistReducer'

const track = (id: string) => themeTrack({ url: id, title: id })

function state(
    ids: string[],
    currentIndex: number,
    playEpoch = 0,
    loopMode: PlaylistQueueState['loopMode'] = 'off',
): PlaylistQueueState {
    return { queue: ids.map(track), currentIndex, playEpoch, loopMode }
}

describe('playlistReducer', () => {
    it('PLAY_NOW on an empty queue inserts at 0 with play intent', () => {
        const next = playlistReducer(EMPTY_PLAYLIST_STATE, { type: 'PLAY_NOW', track: track('a') })
        expect(next.queue.map((t) => t.id)).toEqual(['a'])
        expect(next.currentIndex).toBe(0)
        expect(next.playEpoch).toBe(1)
    })

    it('PLAY_NOW inserts a new track after the current one, preserving the rest', () => {
        const next = playlistReducer(state(['a', 'b'], 0, 3), { type: 'PLAY_NOW', track: track('c') })
        expect(next.queue.map((t) => t.id)).toEqual(['a', 'c', 'b'])
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(4)
    })

    it('PLAY_NOW jumps to an already-queued track without duplicating it', () => {
        const next = playlistReducer(state(['a', 'b'], 0, 1), { type: 'PLAY_NOW', track: track('b') })
        expect(next.queue.map((t) => t.id)).toEqual(['a', 'b'])
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(2)
    })

    it('PLAY_NOW refreshes metadata for an already-queued track', () => {
        const base = playlistReducer(EMPTY_PLAYLIST_STATE, {
            type: 'ENQUEUE',
            track: themeTrack({ url: 'a', title: 'Theme song' }),
        })
        const next = playlistReducer(base, {
            type: 'PLAY_NOW',
            track: themeTrack({
                url: 'a',
                title: 'Ember Hymn',
                cardName: 'Lyra',
                cardType: 'character',
                cardId: 'char-1',
                artworkUrl: '/generated-images/lyra.jpeg',
                durationMs: 95_000,
            }),
        })

        expect(next.queue).toHaveLength(1)
        expect(next.queue[0]).toMatchObject({
            id: 'a',
            title: 'Ember Hymn',
            cardName: 'Lyra',
            cardType: 'character',
            cardId: 'char-1',
            artworkUrl: '/generated-images/lyra.jpeg',
            durationMs: 95_000,
        })
        expect(next.currentIndex).toBe(0)
        expect(next.playEpoch).toBe(1)
    })

    it('ENQUEUE appends, dedupes by id, and selects the first track of an empty queue without play intent', () => {
        const first = playlistReducer(EMPTY_PLAYLIST_STATE, { type: 'ENQUEUE', track: track('a') })
        expect(first.currentIndex).toBe(0)
        expect(first.playEpoch).toBe(0)
        const second = playlistReducer(first, { type: 'ENQUEUE', track: track('b') })
        expect(second.queue.map((t) => t.id)).toEqual(['a', 'b'])
        expect(second.currentIndex).toBe(0)
        expect(playlistReducer(second, { type: 'ENQUEUE', track: track('a') })).toBe(second)
    })

    it('ENQUEUE can enrich an existing track without changing playback intent', () => {
        const base = playlistReducer(EMPTY_PLAYLIST_STATE, {
            type: 'ENQUEUE',
            track: themeTrack({ url: 'a', title: 'Ember Hymn' }),
        })
        const next = playlistReducer(base, {
            type: 'ENQUEUE',
            track: themeTrack({ url: 'a', cardName: 'Lyra', artworkUrl: '/generated-images/lyra.jpeg' }),
        })

        expect(next.queue).toHaveLength(1)
        expect(next.queue[0].title).toBe('Ember Hymn')
        expect(next.queue[0].cardName).toBe('Lyra')
        expect(next.queue[0].artworkUrl).toBe('/generated-images/lyra.jpeg')
        expect(next.currentIndex).toBe(0)
        expect(next.playEpoch).toBe(0)
    })

    it('PLAY_AT plays a valid index and ignores out-of-range ones', () => {
        const base = state(['a', 'b'], 0, 5)
        const next = playlistReducer(base, { type: 'PLAY_AT', index: 1 })
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(6)
        expect(playlistReducer(base, { type: 'PLAY_AT', index: 2 })).toBe(base)
        expect(playlistReducer(base, { type: 'PLAY_AT', index: -1 })).toBe(base)
    })

    it('NEXT advances with play intent and clamps at the end without wrapping', () => {
        const next = playlistReducer(state(['a', 'b'], 0, 1), { type: 'NEXT' })
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(2)
        expect(playlistReducer(next, { type: 'NEXT' })).toBe(next)
    })

    it('NEXT wraps at the end in queue loop mode', () => {
        const next = playlistReducer(state(['a', 'b'], 1, 1, 'queue'), { type: 'NEXT' })
        expect(next.currentIndex).toBe(0)
        expect(next.playEpoch).toBe(2)
    })

    it('PREV steps back, restarts at the first track, and ignores empty queues', () => {
        const back = playlistReducer(state(['a', 'b'], 1, 1), { type: 'PREV' })
        expect(back.currentIndex).toBe(0)
        expect(back.playEpoch).toBe(2)
        const restart = playlistReducer(back, { type: 'PREV' })
        expect(restart.currentIndex).toBe(0)
        expect(restart.playEpoch).toBe(3)
        expect(playlistReducer(EMPTY_PLAYLIST_STATE, { type: 'PREV' })).toBe(EMPTY_PLAYLIST_STATE)
    })

    it('PREV wraps from the first track in queue loop mode', () => {
        const next = playlistReducer(state(['a', 'b'], 0, 1, 'queue'), { type: 'PREV' })
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(2)
    })

    it('REMOVE_AT keeps the current index pointing at the same track when removing before it', () => {
        const next = playlistReducer(state(['a', 'b', 'c'], 2, 4), { type: 'REMOVE_AT', index: 0 })
        expect(next.queue.map((t) => t.id)).toEqual(['b', 'c'])
        expect(next.currentIndex).toBe(1)
        expect(next.playEpoch).toBe(4)
    })

    it('REMOVE_AT of the current track points at the following one (clamped) without play intent', () => {
        const middle = playlistReducer(state(['a', 'b', 'c'], 1, 2), { type: 'REMOVE_AT', index: 1 })
        expect(middle.queue.map((t) => t.id)).toEqual(['a', 'c'])
        expect(middle.currentIndex).toBe(1)
        expect(middle.playEpoch).toBe(2)
        const last = playlistReducer(state(['a', 'b'], 1, 2), { type: 'REMOVE_AT', index: 1 })
        expect(last.currentIndex).toBe(0)
        const only = playlistReducer(state(['a'], 0, 2), { type: 'REMOVE_AT', index: 0 })
        expect(only.currentIndex).toBe(-1)
        expect(only.queue).toHaveLength(0)
    })

    it('CLEAR resets to the empty state', () => {
        expect(playlistReducer(state(['a', 'b'], 1, 7, 'queue'), { type: 'CLEAR' })).toEqual(EMPTY_PLAYLIST_STATE)
    })

    it('CYCLE_LOOP_MODE steps through off, current track, playlist, then off', () => {
        const trackLoop = playlistReducer(state(['a'], 0), { type: 'CYCLE_LOOP_MODE' })
        expect(trackLoop.loopMode).toBe('track')
        const queueLoop = playlistReducer(trackLoop, { type: 'CYCLE_LOOP_MODE' })
        expect(queueLoop.loopMode).toBe('queue')
        const off = playlistReducer(queueLoop, { type: 'CYCLE_LOOP_MODE' })
        expect(off.loopMode).toBe('off')
    })
})

describe('playlist persistence', () => {
    it('round-trips the queue and position, always restoring paused (epoch 0)', () => {
        const restored = restorePlaylistState(serializePlaylist(state(['a', 'b'], 1, 9, 'queue')))
        expect(restored.queue.map((t) => t.id)).toEqual(['a', 'b'])
        expect(restored.currentIndex).toBe(1)
        expect(restored.playEpoch).toBe(0)
        expect(restored.loopMode).toBe('queue')
    })

    it('restores old saved playlists and malformed loop modes with loop off', () => {
        expect(restorePlaylistState(JSON.stringify({ queue: [track('a')], currentIndex: 0 })).loopMode).toBe('off')
        expect(
            restorePlaylistState(JSON.stringify({ queue: [track('a')], currentIndex: 0, loopMode: 'forever' }))
                .loopMode,
        ).toBe('off')
    })

    it('clamps an out-of-range persisted index', () => {
        const restored = restorePlaylistState(JSON.stringify({ queue: [track('a')], currentIndex: 9 }))
        expect(restored.currentIndex).toBe(0)
    })

    it('drops malformed entries and falls back to empty on garbage', () => {
        const restored = restorePlaylistState(
            JSON.stringify({ queue: [track('a'), { nope: true }, 42], currentIndex: 0 }),
        )
        expect(restored.queue.map((t) => t.id)).toEqual(['a'])
        expect(restorePlaylistState('not-json')).toEqual(EMPTY_PLAYLIST_STATE)
        expect(restorePlaylistState(null)).toEqual(EMPTY_PLAYLIST_STATE)
        expect(restorePlaylistState(JSON.stringify({ queue: [] }))).toEqual(EMPTY_PLAYLIST_STATE)
    })
})
