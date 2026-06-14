import type { VoiceSocketServerFrame } from '@/shared/types/voice.types'
import { claimAudioFocus, releaseAudioFocus } from '@/ui/components/audio'

type VoiceAudioChunkFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_chunk' }>
type VoiceAudioFinalFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_final' }>
type VoiceCancelledFrame = Extract<VoiceSocketServerFrame, { type: 'voice_cancelled' }>

export interface VoicePlaybackBufferOptions {
    audio?: HTMLAudioElement
    autoPlay?: boolean
}

export class VoicePlaybackBuffer {
    readonly audio: HTMLAudioElement
    private readonly autoPlay: boolean
    private mediaSource: MediaSource | null = null
    private sourceBuffer: SourceBuffer | null = null
    private objectUrl: string | null = null
    private activeVoiceSessionId: string | null = null
    private activeTurnId: string | null = null
    private expectedSeq = 1
    private finalSeq: number | null = null
    private readonly pendingChunks = new Map<number, Uint8Array>()
    private readonly fallbackChunks: Uint8Array[] = []
    private readonly cancelledTurns = new Set<string>()
    private readonly onUpdateEnd = () => this.flushPendingChunks()
    private readonly onPlay = () => claimAudioFocus(this.audio)
    private readonly onPauseOrEnded = () => releaseAudioFocus(this.audio)

    constructor(options: VoicePlaybackBufferOptions = {}) {
        this.audio = options.audio ?? new Audio()
        this.autoPlay = options.autoPlay ?? true
        this.audio.addEventListener('play', this.onPlay)
        this.audio.addEventListener('pause', this.onPauseOrEnded)
        this.audio.addEventListener('ended', this.onPauseOrEnded)
    }

    startTurn(voiceSessionId: string, turnId: string): void {
        if (this.activeVoiceSessionId && this.activeTurnId && !this.isActiveTurn(voiceSessionId, turnId)) {
            this.cancelledTurns.add(turnKey(this.activeVoiceSessionId, this.activeTurnId))
        }
        this.resetActivePlayback(false)
        this.activeVoiceSessionId = voiceSessionId
        this.activeTurnId = turnId
        this.expectedSeq = 1
        this.finalSeq = null
        this.setupMediaSource()
    }

    appendChunk(frame: VoiceAudioChunkFrame): boolean {
        if (this.isCancelled(frame.voice_session_id, frame.turn_id)) return false
        if (!this.isActiveTurn(frame.voice_session_id, frame.turn_id)) {
            this.startTurn(frame.voice_session_id, frame.turn_id)
        }
        if (this.finalSeq !== null && frame.seq > this.finalSeq) return false
        if (frame.seq < this.expectedSeq || this.pendingChunks.has(frame.seq)) return false

        const bytes = decodeBase64(frame.data_b64)
        if (this.sourceBuffer || this.mediaSource) {
            this.pendingChunks.set(frame.seq, bytes)
            this.flushPendingChunks()
        } else {
            this.appendFallbackChunk(frame.seq, bytes)
        }
        this.playIfAllowed()
        return true
    }

    finalize(frame: VoiceAudioFinalFrame): void {
        if (!this.isActiveTurn(frame.voice_session_id, frame.turn_id)) return
        this.finalSeq = frame.last_seq
        if (!this.mediaSource) {
            this.rebuildFallbackUrl()
            this.playIfAllowed()
            return
        }
        this.endMediaSourceIfComplete()
    }

    cancel(frame?: VoiceCancelledFrame | { voice_session_id?: string; turn_id?: string }): void {
        const voiceSessionId = frame?.voice_session_id ?? this.activeVoiceSessionId
        const turnId = frame?.turn_id ?? this.activeTurnId
        if (voiceSessionId && turnId) this.cancelledTurns.add(turnKey(voiceSessionId, turnId))
        this.resetActivePlayback(true)
    }

    dispose(): void {
        this.resetActivePlayback(true)
        this.audio.removeEventListener('play', this.onPlay)
        this.audio.removeEventListener('pause', this.onPauseOrEnded)
        this.audio.removeEventListener('ended', this.onPauseOrEnded)
    }

    private setupMediaSource(): void {
        if (!canUseMediaSource()) return
        this.mediaSource = new MediaSource()
        this.objectUrl = URL.createObjectURL(this.mediaSource)
        this.audio.src = this.objectUrl
        const open = () => {
            if (!this.mediaSource || this.sourceBuffer) return
            this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg')
            this.sourceBuffer.addEventListener('updateend', this.onUpdateEnd)
            this.flushPendingChunks()
        }
        this.mediaSource.addEventListener('sourceopen', open, { once: true })
        if (this.mediaSource.readyState === 'open') open()
    }

    private appendFallbackChunk(seq: number, bytes: Uint8Array): void {
        if (seq !== this.expectedSeq) {
            this.pendingChunks.set(seq, bytes)
            return
        }
        this.fallbackChunks.push(bytes)
        this.expectedSeq += 1
        while (this.pendingChunks.has(this.expectedSeq)) {
            const next = this.pendingChunks.get(this.expectedSeq)!
            this.pendingChunks.delete(this.expectedSeq)
            this.fallbackChunks.push(next)
            this.expectedSeq += 1
        }
        this.rebuildFallbackUrl()
    }

    private flushPendingChunks(): void {
        if (!this.sourceBuffer || this.sourceBuffer.updating) return
        const next = this.pendingChunks.get(this.expectedSeq)
        if (!next) {
            this.endMediaSourceIfComplete()
            return
        }
        this.pendingChunks.delete(this.expectedSeq)
        this.expectedSeq += 1
        try {
            this.sourceBuffer.appendBuffer(toArrayBuffer(next))
        } catch {
            this.fallbackChunks.push(next)
            this.rebuildFallbackUrl()
        }
    }

    private endMediaSourceIfComplete(): void {
        if (!this.mediaSource || this.finalSeq === null) return
        if (this.expectedSeq <= this.finalSeq || this.pendingChunks.size > 0 || this.sourceBuffer?.updating) return
        if (this.mediaSource.readyState === 'open') {
            try {
                this.mediaSource.endOfStream()
            } catch {
                // ignore finalization races
            }
        }
    }

    private rebuildFallbackUrl(): void {
        if (!canCreateObjectUrl() || this.fallbackChunks.length === 0) return
        this.revokeObjectUrl()
        this.objectUrl = URL.createObjectURL(new Blob(this.fallbackChunks.map(toArrayBuffer), { type: 'audio/mpeg' }))
        this.audio.src = this.objectUrl
    }

    private playIfAllowed(): void {
        if (!this.autoPlay) return
        try {
            claimAudioFocus(this.audio)
            const result = this.audio.play()
            if (result && typeof result.catch === 'function') void result.catch(() => undefined)
        } catch {
            // Autoplay may be blocked; the controller/UI can retry inside a user gesture.
        }
    }

    private resetActivePlayback(markCurrentCancelled: boolean): void {
        if (markCurrentCancelled && this.activeVoiceSessionId && this.activeTurnId) {
            this.cancelledTurns.add(turnKey(this.activeVoiceSessionId, this.activeTurnId))
        }
        if (this.sourceBuffer) {
            this.sourceBuffer.removeEventListener('updateend', this.onUpdateEnd)
        }
        this.sourceBuffer = null
        this.mediaSource = null
        this.pendingChunks.clear()
        this.fallbackChunks.length = 0
        this.finalSeq = null
        this.expectedSeq = 1
        try {
            this.audio.pause()
        } catch {
            // ignore
        }
        releaseAudioFocus(this.audio)
        this.revokeObjectUrl()
        this.audio.removeAttribute('src')
        this.activeVoiceSessionId = null
        this.activeTurnId = null
    }

    private revokeObjectUrl(): void {
        if (this.objectUrl && canCreateObjectUrl()) URL.revokeObjectURL(this.objectUrl)
        this.objectUrl = null
    }

    private isActiveTurn(voiceSessionId: string, turnId: string): boolean {
        return this.activeVoiceSessionId === voiceSessionId && this.activeTurnId === turnId
    }

    private isCancelled(voiceSessionId: string, turnId: string): boolean {
        return this.cancelledTurns.has(turnKey(voiceSessionId, turnId))
    }
}

function canUseMediaSource(): boolean {
    return typeof MediaSource !== 'undefined'
        && typeof MediaSource.isTypeSupported === 'function'
        && MediaSource.isTypeSupported('audio/mpeg')
        && canCreateObjectUrl()
}

function canCreateObjectUrl(): boolean {
    return typeof URL !== 'undefined'
        && typeof URL.createObjectURL === 'function'
        && typeof URL.revokeObjectURL === 'function'
}

function turnKey(voiceSessionId: string, turnId: string): string {
    return `${voiceSessionId}:${turnId}`
}

function decodeBase64(value: string): Uint8Array {
    const binary = atob(value)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return buffer
}
