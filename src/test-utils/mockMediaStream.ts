import { vi } from 'vitest'

type MediaPermissionMode = 'granted' | 'denied'

const DEFAULT_AUDIO_BYTES = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0])

const activeStreams = new Set<MockMediaStream>()

let permissionMode: MediaPermissionMode = 'granted'

export class MockMediaStreamTrack extends EventTarget {
    readonly id: string
    readonly kind: string
    readonly label: string
    enabled = true
    muted = false
    readyState: MediaStreamTrackState = 'live'
    onended: ((this: MediaStreamTrack, ev: Event) => unknown) | null = null
    stop = vi.fn(() => {
        if (this.readyState === 'ended') return
        this.readyState = 'ended'
        const event = new Event('ended')
        this.dispatchEvent(event)
        this.onended?.call(this as unknown as MediaStreamTrack, event)
    })

    constructor(kind = 'audio', id = `mock-${kind}-track`) {
        super()
        this.kind = kind
        this.id = id
        this.label = `Mock ${kind} track`
    }

    clone(): MediaStreamTrack {
        return new MockMediaStreamTrack(this.kind, `${this.id}-clone`) as unknown as MediaStreamTrack
    }
}

export class MockMediaStream extends EventTarget {
    readonly id: string
    active = true
    private readonly tracks: MockMediaStreamTrack[]

    constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
        super()
        this.id = `mock-media-stream-${activeStreams.size + 1}`
        this.tracks = tracks
        activeStreams.add(this)
    }

    getTracks(): MediaStreamTrack[] {
        return this.tracks as unknown as MediaStreamTrack[]
    }

    getAudioTracks(): MediaStreamTrack[] {
        return this.tracks.filter((track) => track.kind === 'audio') as unknown as MediaStreamTrack[]
    }

    getVideoTracks(): MediaStreamTrack[] {
        return this.tracks.filter((track) => track.kind === 'video') as unknown as MediaStreamTrack[]
    }

    stopAll(): void {
        this.tracks.forEach((track) => track.stop())
        this.active = false
    }
}

export class MockMediaRecorder extends EventTarget {
    static isTypeSupported = vi.fn((type: string) => (
        type === '' || type === 'audio/webm' || type === 'audio/webm;codecs=opus' || type === 'audio/wav'
    ))

    readonly stream: MediaStream
    readonly mimeType: string
    state: RecordingState = 'inactive'
    ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => unknown) | null = null
    onstop: ((this: MediaRecorder, ev: Event) => unknown) | null = null

    constructor(stream: MediaStream, options: MediaRecorderOptions = {}) {
        super()
        this.stream = stream
        this.mimeType = options.mimeType || 'audio/webm;codecs=opus'
    }

    start(): void {
        this.state = 'recording'
        this.dispatchEvent(new Event('start'))
    }

    stop(): void {
        if (this.state === 'inactive') return
        this.state = 'inactive'
        this.emitChunk(DEFAULT_AUDIO_BYTES)
        const event = new Event('stop')
        this.dispatchEvent(event)
        this.onstop?.call(this as unknown as MediaRecorder, event)
    }

    pause(): void {
        if (this.state === 'recording') this.state = 'paused'
    }

    resume(): void {
        if (this.state === 'paused') this.state = 'recording'
    }

    requestData(): void {
        if (this.state !== 'inactive') this.emitChunk(DEFAULT_AUDIO_BYTES)
    }

    private emitChunk(bytes: Uint8Array): void {
        const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: this.mimeType })
        const event = new Event('dataavailable') as BlobEvent
        Object.defineProperty(event, 'data', { configurable: true, value: blob })
        this.dispatchEvent(event)
        this.ondataavailable?.call(this as unknown as MediaRecorder, event)
    }
}

class MockAudioWorklet {
    addModule = vi.fn(async () => undefined)
}

class MockAudioNode extends EventTarget {
    connect = vi.fn(() => this)
    disconnect = vi.fn()
}

export class MockAudioContext extends EventTarget {
    readonly sampleRate = 48_000
    state: AudioContextState = 'running'
    currentTime = 0
    destination = new MockAudioNode() as unknown as AudioDestinationNode
    audioWorklet = new MockAudioWorklet() as unknown as AudioWorklet
    close = vi.fn(async () => {
        this.state = 'closed'
    })
    resume = vi.fn(async () => {
        this.state = 'running'
    })
    suspend = vi.fn(async () => {
        this.state = 'suspended'
    })
    createMediaStreamSource = vi.fn(() => new MockAudioNode() as unknown as MediaStreamAudioSourceNode)
    createGain = vi.fn(() => new MockAudioNode() as unknown as GainNode)
}

export class MockAudioWorkletNode extends MockAudioNode {
    readonly port = new MessageChannel().port1

    constructor() {
        super()
    }
}

class MockSourceBuffer extends EventTarget {
    updating = false
    appendBuffer = vi.fn((_buffer: BufferSource) => {
        this.updating = true
        this.updating = false
        this.dispatchEvent(new Event('updateend'))
    })
    remove = vi.fn((_start: number, _end: number) => undefined)
}

export class MockMediaSource extends EventTarget {
    static isTypeSupported = vi.fn((type: string) => type === 'audio/mpeg')
    readyState: ReadyState = 'open'
    readonly sourceBuffers: MockSourceBuffer[] = []
    addSourceBuffer = vi.fn((_mimeType: string) => {
        const buffer = new MockSourceBuffer()
        this.sourceBuffers.push(buffer)
        return buffer as unknown as SourceBuffer
    })
    endOfStream = vi.fn(() => {
        this.readyState = 'ended'
    })
}

export interface MockBrowserMediaControls {
    getUserMedia: ReturnType<typeof vi.fn>
    stream: MockMediaStream
    setPermissionMode(mode: MediaPermissionMode): void
    createStream(trackCount?: number): MockMediaStream
    reset(): void
}

export function createMockMediaStream(trackCount = 1): MockMediaStream {
    const tracks = Array.from({ length: trackCount }, (_, index) => new MockMediaStreamTrack('audio', `mock-audio-track-${index + 1}`))
    return new MockMediaStream(tracks)
}

export function installMockBrowserMedia(): MockBrowserMediaControls {
    const stream = createMockMediaStream()
    const getUserMedia = vi.fn(async (_constraints?: MediaStreamConstraints) => {
        if (permissionMode === 'denied') {
            throw Object.assign(new DOMException('Permission denied', 'NotAllowedError'), { code: 0 })
        }
        return stream as unknown as MediaStream
    })

    if (!globalThis.navigator) {
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
    }

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
    })
    Object.defineProperty(globalThis, 'MediaStreamTrack', { configurable: true, writable: true, value: MockMediaStreamTrack })
    Object.defineProperty(globalThis, 'MediaStream', { configurable: true, writable: true, value: MockMediaStream })
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: MockMediaRecorder })
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: MockAudioContext })
    Object.defineProperty(globalThis, 'webkitAudioContext', { configurable: true, writable: true, value: MockAudioContext })
    Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, writable: true, value: MockAudioWorkletNode })
    Object.defineProperty(globalThis, 'MediaSource', { configurable: true, writable: true, value: MockMediaSource })

    return {
        getUserMedia,
        stream,
        setPermissionMode(mode: MediaPermissionMode) {
            permissionMode = mode
        },
        createStream: createMockMediaStream,
        reset: resetMockBrowserMedia,
    }
}

export function resetMockBrowserMedia(): void {
    permissionMode = 'granted'
    activeStreams.forEach((stream) => stream.stopAll())
    activeStreams.clear()
    MockMediaRecorder.isTypeSupported.mockClear()
    MockMediaSource.isTypeSupported.mockClear()
}
