import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockMediaSource } from '@/test-utils/mockMediaStream'
import { type VoicePlaybackState, VoicePlaybackBuffer } from './voicePlaybackBuffer'

function chunk(seq: number, data_b64: string, turn_id = 'turn-1') {
    return {
        type: 'voice_audio_chunk' as const,
        voice_session_id: 'voice-1',
        turn_id,
        seq,
        content_type: 'audio/mpeg' as const,
        sample_rate: 32000 as const,
        channels: 1 as const,
        data_b64,
        is_final: false as const,
    }
}

function final(last_seq: number, turn_id = 'turn-1') {
    return { type: 'voice_audio_final' as const, voice_session_id: 'voice-1', turn_id, last_seq }
}

function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
}

/** One MPEG-1 layer III frame (32 kbps, 32 kHz, mono → 144 bytes) whose payload is filled with `fill`. */
function mp3Frame(fill: number): Uint8Array {
    const frame = new Uint8Array(144).fill(fill)
    frame.set([0xff, 0xfb, 0x18, 0xc4])
    return frame
}

function bytesOf(...parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

function readBlob(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
    })
}

/** Records every `src` assignment on the element. */
function trackSrcAssignments(audio: HTMLAudioElement): string[] {
    const assignments: string[] = []
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!
    Object.defineProperty(audio, 'src', {
        configurable: true,
        get() {
            return descriptor.get!.call(this)
        },
        set(value: string) {
            assignments.push(value)
            descriptor.set!.call(this, value)
        },
    })
    return assignments
}

async function flushPromises(): Promise<void> {
    for (let index = 0; index < 5; index += 1) await Promise.resolve()
}

describe('VoicePlaybackBuffer', () => {
    let createdUrls = 0

    beforeEach(() => {
        createdUrls = 0
        vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
            createdUrls += 1
            return `blob:voice-${createdUrls}`
        })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
        MockMediaSource.isTypeSupported.mockReturnValue(true)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        delete (globalThis as { ManagedMediaSource?: unknown }).ManagedMediaSource
    })

    describe('MediaSource path', () => {
        it('appends MediaSource MP3 chunks in sequence even when frames arrive buffered', () => {
            const audio = document.createElement('audio')
            const buffer = new VoicePlaybackBuffer({ audio, autoPlay: false })

            buffer.startTurn('voice-1', 'turn-1')
            const mediaSource = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as MockMediaSource
            const sourceBuffer = mediaSource.sourceBuffers[0]

            expect(buffer.appendChunk(chunk(2, 'Ag=='))).toBe(true)
            expect(sourceBuffer.appendBuffer).not.toHaveBeenCalled()

            expect(buffer.appendChunk(chunk(1, 'AQ=='))).toBe(true)
            expect(sourceBuffer.appendBuffer).toHaveBeenCalledTimes(2)
            const first = new Uint8Array(sourceBuffer.appendBuffer.mock.calls[0][0] as ArrayBuffer)
            const second = new Uint8Array(sourceBuffer.appendBuffer.mock.calls[1][0] as ArrayBuffer)
            expect([...first]).toEqual([1])
            expect([...second]).toEqual([2])

            buffer.finalize(final(2))
            expect(mediaSource.endOfStream).toHaveBeenCalledTimes(1)
            buffer.dispose()
        })

        it('reports buffering → playing → idle from the element, only on change', () => {
            const audio = document.createElement('audio')
            const onStateChange = vi.fn<(state: VoicePlaybackState) => void>()
            const buffer = new VoicePlaybackBuffer({ audio, autoPlay: false, onStateChange })
            const listener = vi.fn<(state: VoicePlaybackState) => void>()
            const unsubscribe = buffer.addStateListener(listener)

            buffer.startTurn('voice-1', 'turn-1')
            expect(buffer.state.status).toBe('idle')
            buffer.appendChunk(chunk(1, 'AQ=='))
            buffer.appendChunk(chunk(2, 'Ag=='))
            expect(buffer.state).toEqual({ status: 'buffering', voiceSessionId: 'voice-1', turnId: 'turn-1' })

            audio.dispatchEvent(new Event('playing'))
            audio.dispatchEvent(new Event('playing'))
            expect(buffer.state.status).toBe('playing')

            buffer.finalize(final(2))
            // Server frames are done, but the reply is still audible.
            expect(buffer.state.status).toBe('playing')
            audio.dispatchEvent(new Event('ended'))
            expect(buffer.state).toEqual({ status: 'idle', voiceSessionId: 'voice-1', turnId: 'turn-1' })

            const statuses = onStateChange.mock.calls.map(([state]) => state.status)
            expect(statuses).toEqual(['buffering', 'playing', 'idle'])
            expect(listener.mock.calls.map(([state]) => state.status)).toEqual(statuses)

            unsubscribe()
            buffer.startTurn('voice-1', 'turn-2')
            buffer.appendChunk(chunk(1, 'AQ==', 'turn-2'))
            expect(onStateChange).toHaveBeenCalledTimes(4)
            expect(listener).toHaveBeenCalledTimes(3)
            buffer.dispose()
        })

        it('goes idle (with the cancelled turn ids) on cancel and ignores its late chunks', () => {
            const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio'), autoPlay: false })
            const listener = vi.fn<(state: VoicePlaybackState) => void>()
            buffer.addStateListener(listener)

            buffer.appendChunk(chunk(1, 'AQ=='))
            buffer.cancel({ voice_session_id: 'voice-1', turn_id: 'turn-1' })
            expect(buffer.state).toEqual({ status: 'idle', voiceSessionId: 'voice-1', turnId: 'turn-1' })

            listener.mockClear()
            expect(buffer.appendChunk(chunk(2, 'Ag=='))).toBe(false)
            expect(listener).not.toHaveBeenCalled()
            buffer.dispose()
        })

        it('returns false for stale or duplicate seqs without changing state', () => {
            const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio'), autoPlay: false })
            buffer.appendChunk(chunk(1, 'AQ=='))
            buffer.appendChunk(chunk(3, 'Aw=='))
            const listener = vi.fn()
            buffer.addStateListener(listener)

            expect(buffer.appendChunk(chunk(1, 'AQ=='))).toBe(false)
            expect(buffer.appendChunk(chunk(3, 'Aw=='))).toBe(false)
            buffer.finalize(final(3))
            expect(buffer.appendChunk(chunk(4, 'BA=='))).toBe(false)
            expect(buffer.appendChunk(chunk(0, 'AA==', 'turn-9'))).toBe(false)
            expect(listener).not.toHaveBeenCalled()
            expect(buffer.state.status).toBe('buffering')
            buffer.dispose()
        })

        it('keeps the current turn when a cancel names an older turn', () => {
            const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio'), autoPlay: false })
            buffer.appendChunk(chunk(1, 'AQ==', 'turn-2'))

            buffer.cancel({ voice_session_id: 'voice-1', turn_id: 'turn-1' })

            expect(buffer.state).toEqual({ status: 'buffering', voiceSessionId: 'voice-1', turnId: 'turn-2' })
            expect(buffer.appendChunk(chunk(2, 'Ag==', 'turn-2'))).toBe(true)
            expect(buffer.appendChunk(chunk(1, 'AQ==', 'turn-1'))).toBe(false)
            buffer.dispose()
        })

        it('revokes object URLs when a new turn replaces the active buffer', () => {
            const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio'), autoPlay: false })

            buffer.startTurn('voice-1', 'turn-1')
            expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
            buffer.startTurn('voice-1', 'turn-2')

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1')
            buffer.dispose()
        })
    })

    describe('ManagedMediaSource path', () => {
        class MockManagedMediaSource extends MockMediaSource {
            static isTypeSupported = vi.fn((type: string) => type === 'audio/mpeg')
            streaming = false
        }

        beforeEach(() => {
            MockMediaSource.isTypeSupported.mockReturnValue(false)
            Object.defineProperty(globalThis, 'ManagedMediaSource', { configurable: true, writable: true, value: MockManagedMediaSource })
        })

        it('uses ManagedMediaSource with remote playback disabled and appends only while streaming', () => {
            const audio = document.createElement('audio')
            const buffer = new VoicePlaybackBuffer({ audio, autoPlay: false })

            buffer.startTurn('voice-1', 'turn-1')
            const mediaSource = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as MockManagedMediaSource
            expect(mediaSource).toBeInstanceOf(MockManagedMediaSource)
            expect(audio.disableRemotePlayback).toBe(true)
            const sourceBuffer = mediaSource.sourceBuffers[0]

            buffer.appendChunk(chunk(1, 'AQ=='))
            buffer.appendChunk(chunk(2, 'Ag=='))
            expect(sourceBuffer.appendBuffer).not.toHaveBeenCalled()

            mediaSource.streaming = true
            mediaSource.dispatchEvent(new Event('startstreaming'))
            expect(sourceBuffer.appendBuffer).toHaveBeenCalledTimes(2)

            buffer.finalize(final(2))
            expect(mediaSource.endOfStream).toHaveBeenCalledTimes(1)
            buffer.dispose()
        })

        it('falls back to Blob playback for the turn when ManagedMediaSource never starts playing', async () => {
            vi.useFakeTimers()
            vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise<void>(() => undefined))
            const audio = document.createElement('audio')
            const assignments = trackSrcAssignments(audio)
            const buffer = new VoicePlaybackBuffer({ audio })

            buffer.startTurn('voice-1', 'turn-1')
            const mediaSource = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as MockManagedMediaSource
            mediaSource.streaming = true
            buffer.appendChunk(chunk(1, toBase64(mp3Frame(1))))
            buffer.appendChunk(chunk(2, toBase64(mp3Frame(2))))
            expect(mediaSource.sourceBuffers[0].appendBuffer).toHaveBeenCalledTimes(2)
            expect(assignments).toEqual(['blob:voice-1'])

            await vi.advanceTimersByTimeAsync(1_900)
            expect(assignments).toHaveLength(1)
            await vi.advanceTimersByTimeAsync(200)

            // The whole turn so far replays as one Blob.
            expect(assignments).toEqual(['blob:voice-1', 'blob:voice-2'])
            const blob = vi.mocked(URL.createObjectURL).mock.calls[1][0] as Blob
            vi.useRealTimers()
            expect(await readBlob(blob)).toEqual(bytesOf(mp3Frame(1), mp3Frame(2)))

            audio.dispatchEvent(new Event('playing'))
            expect(buffer.state.status).toBe('playing')
            buffer.dispose()
        })

        it('falls back to Blob playback when ManagedMediaSource never asks for data', async () => {
            vi.useFakeTimers()
            vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise<void>(() => undefined))
            const audio = document.createElement('audio')
            const assignments = trackSrcAssignments(audio)
            const buffer = new VoicePlaybackBuffer({ audio })

            buffer.startTurn('voice-1', 'turn-1')
            const mediaSource = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as MockManagedMediaSource
            buffer.appendChunk(chunk(1, toBase64(mp3Frame(1))))
            // `streaming` stays false and `startstreaming` never fires: nothing is appended.
            expect(mediaSource.sourceBuffers[0].appendBuffer).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(2_100)

            expect(assignments).toEqual(['blob:voice-1', 'blob:voice-2'])
            const blob = vi.mocked(URL.createObjectURL).mock.calls[1][0] as Blob
            vi.useRealTimers()
            expect(await readBlob(blob)).toEqual(mp3Frame(1))
            buffer.dispose()
        })
    })

    describe('Blob fallback path (no MediaSource)', () => {
        beforeEach(() => {
            MockMediaSource.isTypeSupported.mockReturnValue(false)
        })

        it('falls back to Blob URLs when MediaSource MP3 append is unavailable', () => {
            const audio = document.createElement('audio')
            const buffer = new VoicePlaybackBuffer({ audio, autoPlay: false })

            buffer.startTurn('voice-1', 'turn-1')
            expect(buffer.appendChunk(chunk(1, 'AQ=='))).toBe(true)
            expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
            expect(audio.src).toContain('blob:voice-1')

            buffer.cancel({ voice_session_id: 'voice-1', turn_id: 'turn-1' })
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1')
            buffer.dispose()
        })

        it('plays chunks as sequential groups without touching src mid-playback', async () => {
            const audio = document.createElement('audio')
            const assignments = trackSrcAssignments(audio)
            const buffer = new VoicePlaybackBuffer({ audio })
            const statuses: string[] = []
            buffer.addStateListener((state) => statuses.push(state.status))
            const [a, b, c, d] = [mp3Frame(0xa), mp3Frame(0xb), mp3Frame(0xc), mp3Frame(0xd)]

            // Chunk 1 ends half-way through frame B: only whole frames are played now.
            buffer.appendChunk(chunk(1, toBase64(bytesOf(a, b.subarray(0, 72)))))
            expect(assignments).toEqual(['blob:voice-1'])
            audio.dispatchEvent(new Event('playing'))

            // More audio arrives (out of order) while group 1 is audible.
            buffer.appendChunk(chunk(3, toBase64(bytesOf(c.subarray(100), d))))
            buffer.appendChunk(chunk(2, toBase64(bytesOf(b.subarray(72), c.subarray(0, 100)))))
            buffer.finalize(final(3))
            expect(assignments).toEqual(['blob:voice-1'])
            expect(buffer.state.status).toBe('playing')

            // Group 1 ends → everything received since plays next, in order, from its start.
            audio.dispatchEvent(new Event('ended'))
            expect(assignments).toEqual(['blob:voice-1', 'blob:voice-2'])
            expect(buffer.state.status).toBe('playing')
            audio.dispatchEvent(new Event('playing'))

            audio.dispatchEvent(new Event('ended'))
            expect(assignments).toHaveLength(2)
            expect(buffer.state).toEqual({ status: 'idle', voiceSessionId: 'voice-1', turnId: 'turn-1' })
            expect(statuses).toEqual(['buffering', 'playing', 'idle'])

            const blobs = vi.mocked(URL.createObjectURL).mock.calls.map(([blob]) => blob as Blob)
            expect(await readBlob(blobs[0])).toEqual(a)
            expect(await readBlob(blobs[1])).toEqual(bytesOf(b, c, d))
            expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
            buffer.dispose()
        })

        it('flushes a trailing partial frame once the turn is final', async () => {
            const audio = document.createElement('audio')
            const assignments = trackSrcAssignments(audio)
            const buffer = new VoicePlaybackBuffer({ audio })
            const [a, b] = [mp3Frame(0xa), mp3Frame(0xb)]

            buffer.appendChunk(chunk(1, toBase64(bytesOf(a, b.subarray(0, 50)))))
            audio.dispatchEvent(new Event('playing'))
            audio.dispatchEvent(new Event('ended'))
            // Only a partial frame is left and the turn isn't final: wait for more bytes.
            expect(assignments).toHaveLength(1)

            buffer.finalize(final(1))
            expect(assignments).toHaveLength(2)
            const blob = vi.mocked(URL.createObjectURL).mock.calls[1][0] as Blob
            expect(await readBlob(blob)).toEqual(b.subarray(0, 50))
            audio.dispatchEvent(new Event('ended'))
            expect(buffer.state.status).toBe('idle')
            buffer.dispose()
        })
    })

    describe('autoplay', () => {
        it('surfaces a rejected play() as blocked and recovers through resume()', async () => {
            const play = vi.mocked(HTMLMediaElement.prototype.play)
            play.mockRejectedValue(new DOMException('Autoplay blocked', 'NotAllowedError'))
            const audio = document.createElement('audio')
            const buffer = new VoicePlaybackBuffer({ audio })

            buffer.appendChunk(chunk(1, 'AQ=='))
            await flushPromises()
            expect(buffer.state).toEqual({ status: 'blocked', voiceSessionId: 'voice-1', turnId: 'turn-1' })

            // More chunks don't hide the blocked state.
            buffer.appendChunk(chunk(2, 'Ag=='))
            await flushPromises()
            expect(buffer.state.status).toBe('blocked')

            // From the user's tap.
            play.mockResolvedValue(undefined)
            await expect(buffer.resume()).resolves.toBe(true)
            expect(buffer.state.status).toBe('playing')
            buffer.dispose()
        })

        it('treats an aborted play() as benign', async () => {
            vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Interrupted', 'AbortError'))
            const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio') })

            buffer.appendChunk(chunk(1, 'AQ=='))
            await flushPromises()
            expect(buffer.state.status).toBe('buffering')
            buffer.dispose()
        })

        it('unlock() primes the element with a silent clip once, inside the gesture', async () => {
            const audio = document.createElement('audio')
            const assignments = trackSrcAssignments(audio)
            const play = vi.mocked(HTMLMediaElement.prototype.play)
            const mutedDuringPlay: boolean[] = []
            play.mockImplementation(function (this: HTMLMediaElement) {
                mutedDuringPlay.push(this.muted)
                return Promise.resolve()
            })
            const buffer = new VoicePlaybackBuffer({ audio })

            buffer.unlock()
            // Synchronous: play() ran in the same call (muted), and the element is unmuted again.
            expect(play).toHaveBeenCalledTimes(1)
            expect(mutedDuringPlay).toEqual([true])
            expect(audio.muted).toBe(false)
            expect(assignments).toHaveLength(1)
            expect(assignments[0]).toMatch(/^data:audio\/wav;base64,/)
            // The primer is not a turn.
            audio.dispatchEvent(new Event('playing'))
            expect(buffer.state.status).toBe('idle')

            await flushPromises()
            expect(audio.hasAttribute('src')).toBe(false)
            expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()

            buffer.unlock()
            expect(play).toHaveBeenCalledTimes(1)
            buffer.dispose()
        })

        it('keeps working after dispose() when the instance is reused (StrictMode remount)', () => {
            const audio = document.createElement('audio')
            const buffer = new VoicePlaybackBuffer({ audio, autoPlay: false })
            buffer.dispose()

            buffer.startTurn('voice-1', 'turn-1')
            buffer.appendChunk(chunk(1, 'AQ=='))
            audio.dispatchEvent(new Event('playing'))
            expect(buffer.state.status).toBe('playing')
            buffer.dispose()
        })
    })
})
