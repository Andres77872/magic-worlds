import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockAudioContext } from '@/test-utils/mockMediaStream'
import { VoiceVadWorkletSegmenter } from '../audio/voiceVadWorklet'
import { useMicrophoneCapture } from './useMicrophoneCapture'

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

    it.each([false, true])('reports permission denied and leaves no capture running (StrictMode: %s)', async (reactStrictMode) => {
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')) },
        })
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }), { reactStrictMode })

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('permission_denied')
        expect(result.current.error).toContain('denied')
    })

    it('fails closed when the required PCM AudioWorklet path is unavailable', async () => {
        const original = globalThis.AudioWorkletNode
        Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, writable: true, value: undefined })
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('unsupported')
        expect(result.current.source).toBeNull()
        const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia)
        const stream = await getUserMedia.mock.results[0].value as MediaStream
        const track = stream.getAudioTracks()[0]
        expect(track.readyState).toBe('ended')
        Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, writable: true, value: original })
    })

    it.each([false, true])('resumes a suspended AudioContext so worklet capture is not silently dead (StrictMode: %s)', async (reactStrictMode) => {
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

        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }), { reactStrictMode })

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
