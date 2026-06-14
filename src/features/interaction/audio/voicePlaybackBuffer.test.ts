import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockMediaSource } from '@/test-utils/mockMediaStream'
import { VoicePlaybackBuffer } from './voicePlaybackBuffer'

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
        vi.restoreAllMocks()
    })

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

        buffer.finalize({ type: 'voice_audio_final', voice_session_id: 'voice-1', turn_id: 'turn-1', last_seq: 2 })
        expect(mediaSource.endOfStream).toHaveBeenCalledTimes(1)
        buffer.dispose()
    })

    it('falls back to Blob URLs when MediaSource MP3 append is unavailable', () => {
        MockMediaSource.isTypeSupported.mockReturnValue(false)
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

    it('drops stale chunks after a turn is cancelled', () => {
        const buffer = new VoicePlaybackBuffer({ audio: document.createElement('audio'), autoPlay: false })

        buffer.startTurn('voice-1', 'turn-1')
        buffer.cancel({ voice_session_id: 'voice-1', turn_id: 'turn-1' })

        expect(buffer.appendChunk(chunk(1, 'AQ=='))).toBe(false)
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
