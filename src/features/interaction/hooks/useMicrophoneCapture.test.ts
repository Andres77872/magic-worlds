import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockAudioContext } from '@/test-utils/mockMediaStream'
import { VoiceVadWorkletSegmenter } from '../audio/voiceVadWorklet'
import { useMicrophoneCapture } from './useMicrophoneCapture'

async function flushPromises(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}

describe('useMicrophoneCapture', () => {
    it('does not request microphone capture until voice consent is granted', async () => {
        const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia)
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: false }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('consent_required')
        expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('reports permission denied and leaves no capture running', async () => {
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')) },
        })
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('permission_denied')
        expect(result.current.error).toContain('denied')
    })

    it('uses MediaRecorder fallback, emits monotonic metadata, and tears down tracks', async () => {
        const onSegment = vi.fn()
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true, onSegment, preferWorklet: false }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(true)
        })

        expect(result.current.status).toBe('capturing')
        expect(result.current.source).toBe('media_recorder')
        const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia)
        const stream = await getUserMedia.mock.results[0].value as MediaStream
        const track = stream.getAudioTracks()[0]
        expect(track.readyState).toBe('live')

        act(() => result.current.stop())
        await flushPromises()

        expect(track.readyState).toBe('ended')
        await waitFor(() => expect(onSegment).toHaveBeenCalledTimes(1))
        const segment = onSegment.mock.calls[0][0]
        expect(segment).toMatchObject({
            seq: 1,
            encoding: 'audio/webm;codecs=opus',
            channels: 1,
        })
        expect(segment.audio_sha256).toHaveLength(64)
        expect(segment.byte_length).toBeGreaterThan(0)
    })

    it('resumes a suspended AudioContext so worklet capture is not silently dead', async () => {
        // Browsers can hand back a 'suspended' context when it is created after the awaited
        // getUserMedia (past the synchronous user gesture). Without resume(), the worklet's
        // process() is never pulled — no level/VAD/segment — so the call sits on "Listening".
        const instances: MockAudioContext[] = []
        class SuspendedAudioContext extends MockAudioContext {
            constructor() {
                super()
                this.state = 'suspended'
                instances.push(this)
            }
        }
        Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: SuspendedAudioContext })

        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(true)
        })

        expect(result.current.status).toBe('capturing')
        expect(result.current.source).toBe('audio_worklet')
        expect(instances).toHaveLength(1)
        expect(instances[0].resume).toHaveBeenCalled()
        expect(instances[0].state).toBe('running')
    })

    it('returns unsupported when no capture primitive is available', async () => {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('unsupported')
    })

    it('builds PCM16 WAV segments from the worklet segmenter', async () => {
        const onSegment = vi.fn()
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment, aggressiveness: 'strict' })

        const segment = await segmenter.emitPcm16(new Int16Array([0, 2000, -2000, 1000]), { startedAtMs: 25, speechMs: 20, silenceMs: 5 })

        expect(onSegment).toHaveBeenCalledWith(segment)
        expect(segment).toMatchObject({
            seq: 1,
            started_at_ms: 25,
            encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            vad: expect.objectContaining({ source: 'audio_worklet', aggressiveness: 'strict' }),
        })
        expect(segment.audio.type).toBe('audio/wav;codec=pcm_s16le')
        expect(segment.byte_length).toBe(44 + 4 * 2)
        expect(segment.audio_sha256).toHaveLength(64)
    })
})
