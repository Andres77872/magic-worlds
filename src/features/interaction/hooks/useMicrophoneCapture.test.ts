import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockAudioContext, MockMediaStream, MockMediaStreamTrack } from '@/test-utils/mockMediaStream'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import { VoiceVadWorkletSegmenter } from '../audio/voiceVadWorklet'
import { type UseMicrophoneCaptureOptions, useMicrophoneCapture } from './useMicrophoneCapture'

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
        expect(result.current.errorCode).toBe('permission_denied')
    })

    it('fails closed when the required PCM AudioWorklet path is unavailable', async () => {
        const original = globalThis.AudioWorkletNode
        Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, writable: true, value: undefined })
        const { result } = renderHook(() => useMicrophoneCapture({ consentGranted: true }))

        await act(async () => {
            await expect(result.current.start()).resolves.toBe(false)
        })

        expect(result.current.status).toBe('unsupported')
        expect(result.current.errorCode).toBe('unsupported')
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

/** A track that reports its applied settings (the shared mock has no getSettings). */
class SettingsTrack extends MockMediaStreamTrack {
    private readonly settings: MediaTrackSettings

    constructor(settings: MediaTrackSettings) {
        super('audio')
        this.settings = settings
    }

    getSettings(): MediaTrackSettings {
        return this.settings
    }
}

/** AudioWorkletNode stand-in that records its options and lets a test post worklet messages. */
class RecordingWorkletNode extends EventTarget {
    static instances: RecordingWorkletNode[] = []
    readonly options: AudioWorkletNodeOptions | undefined
    readonly port = { postMessage: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null }
    connect = vi.fn(() => this)
    disconnect = vi.fn()

    constructor(_context: unknown, _name: string, options?: AudioWorkletNodeOptions) {
        super()
        this.options = options
        RecordingWorkletNode.instances.push(this)
    }

    emit(data: unknown): void {
        this.port.onmessage?.({ data })
    }
}

function segmentMessage(samples = [0, 1_000, -1_000, 0]) {
    return { type: 'segment', samples: new Int16Array(samples), sample_rate: 16_000, started_at_ms: 0, speech_ms: 0, silence_ms: 0 }
}

describe('useMicrophoneCapture — restarts, mute, tuning and level', () => {
    let streams: MockMediaStream[]
    let getUserMedia: ReturnType<typeof vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>>

    beforeEach(() => {
        RecordingWorkletNode.instances = []
        streams = []
        // A fresh stream per request (a restart must get new tracks), reporting the AEC it was asked for.
        getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
            const audio = constraints.audio as MediaTrackConstraints
            const stream = new MockMediaStream([new SettingsTrack({ echoCancellation: Boolean(audio.echoCancellation) })])
            streams.push(stream)
            return stream as unknown as MediaStream
        })
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
        Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, writable: true, value: RecordingWorkletNode })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    function lastTrack(): MediaStreamTrack {
        return streams[streams.length - 1].getAudioTracks()[0]
    }

    function lastNode(): RecordingWorkletNode {
        return RecordingWorkletNode.instances[RecordingWorkletNode.instances.length - 1]
    }

    async function settle(): Promise<void> {
        await act(async () => {
            if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
            else await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }

    async function startCapture(options: Partial<UseMicrophoneCaptureOptions> = {}) {
        const hook = renderHook(() => useMicrophoneCapture({ consentGranted: true, ...options }))
        await act(async () => {
            await expect(hook.result.current.start()).resolves.toBe(true)
        })
        return hook
    }

    it('rebuilds the AudioContext at the device rate when the 16 kHz one rejects the mic (Firefox)', async () => {
        const contexts: Array<MockAudioContext & { requestedRate?: number }> = []
        class FirefoxAudioContext extends MockAudioContext {
            requestedRate?: number

            constructor(options?: AudioContextOptions) {
                super()
                this.requestedRate = options?.sampleRate
                if (options?.sampleRate) {
                    Object.defineProperty(this, 'sampleRate', { value: options.sampleRate })
                    this.createMediaStreamSource = vi.fn(() => {
                        throw new DOMException('Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported.', 'NotSupportedError')
                    })
                }
                contexts.push(this)
            }
        }
        Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: FirefoxAudioContext })

        const { result } = await startCapture()

        expect(contexts.map((context) => context.requestedRate)).toEqual([16_000, undefined])
        expect(contexts[0].close).toHaveBeenCalled()
        expect(contexts[1].audioWorklet.addModule).toHaveBeenCalledTimes(1)
        expect(contexts[1].createMediaStreamSource).toHaveBeenCalledTimes(1)
        expect(RecordingWorkletNode.instances).toHaveLength(1)
        expect(result.current.status).toBe('capturing')
        expect(result.current.source).toBe('audio_worklet')
        expect(result.current.echoCancellation).toBe(true)
        expect(result.current.errorCode).toBeNull()
    })

    it('does not run the no-input watchdog while muted, and re-arms it on unmute', async () => {
        vi.useFakeTimers()
        const { result } = await startCapture()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000)
        })
        act(() => result.current.mute())
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
        })
        // A muted track reads exactly zero — that must not count as a dead stream.
        expect(getUserMedia).toHaveBeenCalledTimes(1)
        expect(result.current.isMuted).toBe(true)
        expect(result.current.rawFallbackActive).toBe(false)
        expect(lastTrack().enabled).toBe(false)

        // Unmuting starts a full new window; a still-silent stream then falls back to raw capture.
        act(() => result.current.unmute())
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_900)
        })
        expect(getUserMedia).toHaveBeenCalledTimes(1)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200)
        })
        expect(getUserMedia).toHaveBeenCalledTimes(2)
        expect(getUserMedia.mock.calls[1][0]).toMatchObject({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        expect(result.current.rawFallbackActive).toBe(true)
        expect(result.current.echoCancellation).toBe(false)
        expect(result.current.status).toBe('capturing')
    })

    it('keeps the mic muted across the raw-constraints restart', async () => {
        vi.useFakeTimers()
        const { result } = await startCapture()
        const gate: { release?: () => void } = {}
        const fresh = getUserMedia.getMockImplementation()!
        getUserMedia.mockImplementationOnce(async (constraints: MediaStreamConstraints) => {
            await new Promise<void>((resolve) => {
                gate.release = resolve
            })
            return fresh(constraints)
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3_000)
        })
        expect(getUserMedia).toHaveBeenCalledTimes(2)
        // The user mutes while the restart's getUserMedia is still pending.
        act(() => result.current.mute())
        await act(async () => {
            gate.release?.()
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(streams).toHaveLength(2)
        expect(result.current.status).toBe('capturing')
        expect(result.current.isMuted).toBe(true)
        expect(lastTrack().enabled).toBe(false)
    })

    it('restarts once when the input device disappears, keeping mute, then reports device_lost', async () => {
        const { result } = await startCapture()
        act(() => result.current.mute())

        lastTrack().dispatchEvent(new Event('ended'))
        await settle()
        expect(getUserMedia).toHaveBeenCalledTimes(2)
        expect(getUserMedia.mock.calls[1][0]).toEqual(getUserMedia.mock.calls[0][0])
        expect(result.current.status).toBe('capturing')
        expect(result.current.isMuted).toBe(true)
        expect(lastTrack().enabled).toBe(false)

        // The replacement goes away too before ever producing signal: give up.
        lastTrack().dispatchEvent(new Event('ended'))
        await settle()
        expect(getUserMedia).toHaveBeenCalledTimes(2)
        expect(result.current.status).toBe('error')
        expect(result.current.errorCode).toBe('device_lost')
    })

    it('reports device_lost when the restart after an unplug fails', async () => {
        const { result } = await startCapture()
        getUserMedia.mockRejectedValueOnce(new DOMException('Requested device not found', 'NotFoundError'))

        lastTrack().dispatchEvent(new Event('ended'))
        await settle()

        expect(result.current.status).toBe('error')
        expect(result.current.errorCode).toBe('device_lost')
    })

    it('posts configure to the live worklet and re-applies it after a restart', async () => {
        const { result } = await startCapture({ vad: { silenceMsToEnd: 600 } })

        act(() => result.current.configure({ maxSegmentMs: 6_000, speechThreshold: undefined }))
        expect(lastNode().port.postMessage).toHaveBeenCalledWith({ type: 'configure', maxSegmentMs: 6_000 })

        lastTrack().dispatchEvent(new Event('ended'))
        await settle()
        expect(RecordingWorkletNode.instances).toHaveLength(2)
        expect(lastNode().options?.processorOptions).toMatchObject({ maxSegmentMs: 6_000, silenceMsToEnd: 600 })
    })

    it('keeps segment seqs monotonic across internal restarts and restarts them on a user start()', async () => {
        const onSegment = vi.fn<(segment: CapturedVoiceSegment) => void>()
        const { result } = await startCapture({ onSegment })

        // Two segments posted back to back still get distinct seqs.
        act(() => {
            lastNode().emit(segmentMessage())
            lastNode().emit(segmentMessage([5, 6]))
        })
        await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(2))

        lastTrack().dispatchEvent(new Event('ended'))
        await settle()
        expect(RecordingWorkletNode.instances).toHaveLength(2)
        act(() => lastNode().emit(segmentMessage()))
        await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(3))
        expect(onSegment.mock.calls.map(([segment]) => segment.seq).sort()).toEqual([1, 2, 3])
        expect(result.current.nextSeq).toBe(4)

        act(() => result.current.stop())
        await act(async () => {
            await expect(result.current.start()).resolves.toBe(true)
        })
        act(() => lastNode().emit(segmentMessage()))
        await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(4))
        expect(onSegment.mock.calls[3][0].seq).toBe(1)

        // start() without a stop() in between also opens a new session.
        await act(async () => {
            await expect(result.current.start()).resolves.toBe(true)
        })
        act(() => lastNode().emit(segmentMessage()))
        await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(5))
        expect(onSegment.mock.calls[4][0].seq).toBe(1)
    })

    it('stamps each segment with its end of speech: the closing speech_end minus its hang-over (R0-BE-37)', async () => {
        const onSegment = vi.fn<(segment: CapturedVoiceSegment) => void>()
        const onVadState = vi.fn()
        await startCapture({ onSegment, onVadState })
        const now = vi.spyOn(performance, 'now').mockReturnValue(8_000)
        try {
            // The worklet posts each segment, then the speech_end that closed it.
            act(() => {
                lastNode().emit(segmentMessage())
                lastNode().emit({ type: 'vad', state: 'speech_end', at_ms: 1_200, rms: 0.01, ended_by_silence: true, silence_tail_ms: 552 })
            })
            await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(1))
            expect(onSegment.mock.calls[0][0].speech_end_perf_ms).toBe(7_448)
            expect(onVadState).toHaveBeenCalledWith('speech_end', expect.objectContaining({ rms: 0.01 }))

            // A max-length cut: the user is still talking, so no end of speech.
            act(() => {
                lastNode().emit(segmentMessage([3, 4]))
                lastNode().emit({ type: 'vad', state: 'speech_end', at_ms: 9_000, rms: 0.2, ended_by_silence: false, silence_tail_ms: 0 })
            })
            await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(2))
            expect(onSegment.mock.calls[1][0].speech_end_perf_ms).toBeUndefined()
            onSegment.mockClear()

            // A speech_start never stamps anything.
            now.mockReturnValue(9_000)
            act(() => {
                lastNode().emit({ type: 'vad', state: 'speech_start', at_ms: 2_000, rms: 0.2 })
                lastNode().emit(segmentMessage([7, 8]))
            })
            await vi.waitFor(() => expect(onSegment).toHaveBeenCalledTimes(1))
            expect(onSegment.mock.calls[0][0].speech_end_perf_ms).toBeUndefined()
        } finally {
            now.mockRestore()
        }
    })

    it('throttles onLevel to ~15 Hz and skips changes under 0.02', async () => {
        vi.useFakeTimers()
        const onLevel = vi.fn()
        await startCapture({ onLevel })
        const node = lastNode()

        // 1 s of worklet levels at 50 ms that keep changing a lot.
        for (let index = 0; index < 20; index += 1) {
            act(() => node.emit({ type: 'level', rms: index % 2 === 0 ? 0.6 : 0.2 }))
            act(() => vi.advanceTimersByTime(50))
        }
        expect(onLevel.mock.calls.length).toBeGreaterThan(5)
        expect(onLevel.mock.calls.length).toBeLessThanOrEqual(15)

        onLevel.mockClear()
        act(() => vi.advanceTimersByTime(200))
        act(() => node.emit({ type: 'level', rms: 0.31 }))
        act(() => vi.advanceTimersByTime(200))
        act(() => node.emit({ type: 'level', rms: 0.32 }))
        expect(onLevel.mock.calls).toEqual([[0.31]])
    })
})
