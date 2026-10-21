import type { VoiceAudioFormat, VoiceSocketServerFrame, VoiceTurnPlaybackPath } from '@/shared/types/voice.types'
import { clipGainDb, clipVolume } from '@/shared/voice/clipVolume'
import { claimAudioFocus, releaseAudioFocus } from '@/ui/components/audio'
import { chooseCallAudioSink, isPlayableCallChunk, type CallAudioSink } from './audioFormat'

type VoiceAudioChunkFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_chunk' }>
type VoiceAudioFinalFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_final' }>
type VoiceCancelledFrame = Extract<VoiceSocketServerFrame, { type: 'voice_cancelled' }>

/**
 * What the listener hears for the current turn:
 * - `buffering`: chunks were accepted but nothing is audible yet;
 * - `playing`: the element started playing this turn;
 * - `idle`: the turn played out (or was cancelled/reset) — the ids name that turn;
 * - `blocked`: autoplay policy rejected `play()`; call `resume()` from a user gesture.
 */
export interface VoicePlaybackState {
    status: 'idle' | 'buffering' | 'playing' | 'blocked'
    voiceSessionId: string | null
    turnId: string | null
}

export type VoicePlaybackStateListener = (state: VoicePlaybackState) => void

/** How the active turn reaches the element (R01 `playback_path`). */
export type VoicePlaybackPath = Exclude<VoiceTurnPlaybackPath, 'none'>

/**
 * An element media event of the active turn, for the R01 turn timeline: `waiting` and
 * `stalled` mark a stall, the next `playing` ends it. Reported only while the turn owns
 * the element; the state listener already carries the first `playing`.
 */
export interface VoicePlaybackMediaEvent {
    type: 'playing' | 'waiting' | 'stalled'
    voiceSessionId: string
    turnId: string
}

export type VoicePlaybackMediaListener = (event: VoicePlaybackMediaEvent) => void

export interface VoicePlaybackBufferOptions {
    audio?: HTMLAudioElement
    autoPlay?: boolean
    onStateChange?: VoicePlaybackStateListener
    /**
     * A chunk of this turn is not audio the player can decode (R1-FE-05): it is
     * dropped and the reply stays as text. Called once per turn.
     */
    onUnsupportedFormat?: (turnId: string, voiceSessionId: string) => void
}

type PlaybackMode = 'media_source' | 'fallback'

/** `ManagedMediaSource` (Safari 17.1+, the only MSE on iPhone) — not in the TS DOM lib yet. */
type ManagedMediaSourceLike = MediaSource & { readonly streaming?: boolean }

/** If ManagedMediaSource received the turn's audio but never started playing within this
 *  window, the turn switches to Blob playback (WebKit may claim audio/mpeg support it can't
 *  play, or never ask for data at all). */
const MANAGED_STALL_MS = 2_000
const MAX_REMEMBERED_CANCELLED_TURNS = 64

/**
 * Plays one streamed MP3 reply per turn on a single reusable <audio> element.
 *
 * Paths, in order of preference:
 * 1. `MediaSource` — chunks are appended to a SourceBuffer as they arrive.
 * 2. `ManagedMediaSource` (iPhone) — same, but appends only while the UA is `streaming`, and
 *    falls back to (3) if it never starts playing.
 * 3. Sequential Blob groups — the element's `src` is never replaced mid-playback (that
 *    restarts the reply from 0). Bytes queue while a group plays; when it ends, everything
 *    received since plays as the next group.
 */
export class VoicePlaybackBuffer {
    readonly audio: HTMLAudioElement
    private readonly autoPlay: boolean
    private readonly listeners = new Set<VoicePlaybackStateListener>()
    private readonly mediaListeners = new Set<VoicePlaybackMediaListener>()
    private currentState: VoicePlaybackState = { status: 'idle', voiceSessionId: null, turnId: null }
    private elementListenersAttached = false
    private unlocked = false
    /** Who put the current `src` on the element: the active turn, the unlock primer, or nobody. */
    private elementOwner: 'turn' | 'priming' | null = null
    /** Bumped on every `src` change, so a late play() result for an old source is ignored. */
    private sourceToken = 0

    private activeVoiceSessionId: string | null = null
    private activeTurnId: string | null = null
    private mode: PlaybackMode = 'fallback'
    private managed = false
    private mediaSource: ManagedMediaSourceLike | null = null
    private sourceBuffer: SourceBuffer | null = null
    private objectUrl: string | null = null
    private expectedSeq = 1
    private finalSeq: number | null = null
    /** Chunks that arrived ahead of `expectedSeq`. */
    private readonly pendingChunks = new Map<number, Uint8Array>()
    /** In-order bytes not yet handed to the SourceBuffer / a Blob group. */
    private queue: Uint8Array[] = []
    /** Every in-order chunk of a MediaSource turn, kept to replay it as Blobs if MSE fails before playing. */
    private turnBytes: Uint8Array[] = []
    private appendedCount = 0
    private groupActive = false
    private hasPlayed = false
    private playRequested = false
    private turnFinished = false
    private stallTimer: ReturnType<typeof setTimeout> | null = null
    private readonly cancelledTurns = new Set<string>()
    /** Turns whose unplayable chunk was already reported. */
    private readonly unsupportedTurns = new Set<string>()
    private readonly onUnsupportedFormat?: (turnId: string, voiceSessionId: string) => void
    /** Where replies play (`voice_ready.audio`, R1): MediaSource, or Blob groups when MSE refuses the type. */
    private sink: CallAudioSink = 'mse'
    /** Audio of the active turn already played in earlier Blob groups (or before a mid-turn switch), in ms. */
    private playedBeforeGroupMs = 0
    /** The active turn's loudness gain (D16) was read from its first accepted chunk. */
    private turnGainRead = false
    /** The element volume carries a turn's gain, so a later turn without one restores it. */
    private gainApplied = false

    private readonly onUpdateEnd = () => this.pump()
    private readonly onStartStreaming = () => this.pump()
    private readonly onPlay = () => {
        if (this.elementOwner === 'turn') claimAudioFocus(this.audio)
    }
    private readonly onPause = () => releaseAudioFocus(this.audio)
    private readonly onPlaying = () => {
        this.handlePlaying()
        this.emitMediaEvent('playing')
    }
    private readonly onWaiting = () => this.emitMediaEvent('waiting')
    private readonly onStalled = () => this.emitMediaEvent('stalled')
    private readonly onEnded = () => this.handleEnded()
    private readonly onError = () => this.handleElementError()

    constructor(options: VoicePlaybackBufferOptions = {}) {
        this.audio = options.audio ?? new Audio()
        this.autoPlay = options.autoPlay ?? true
        this.onUnsupportedFormat = options.onUnsupportedFormat
        if (options.onStateChange) this.listeners.add(options.onStateChange)
        this.attachElementListeners()
    }

    get state(): VoicePlaybackState {
        return this.currentState
    }

    /** Subscribes to state changes (emitted only on change); returns the unsubscribe. */
    addStateListener(listener: VoicePlaybackStateListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /** Subscribes to the active turn's element media events (stalls); returns the unsubscribe. */
    addMediaEventListener(listener: VoicePlaybackMediaListener): () => void {
        this.mediaListeners.add(listener)
        return () => {
            this.mediaListeners.delete(listener)
        }
    }

    /**
     * How `turnId` (default: the active turn) plays right now; null when that turn is not
     * the active one. A turn can leave MediaSource for Blob groups mid-way.
     */
    playbackPath(turnId?: string): VoicePlaybackPath | null {
        if (!this.activeTurnId || (turnId !== undefined && turnId !== this.activeTurnId)) return null
        if (this.mode === 'fallback') return 'blob'
        return this.managed ? 'managed_media_source' : 'media_source'
    }

    /**
     * The call's announced audio (`voice_ready.audio`; absent only from an older
     * BFF build). A type MediaSource refuses plays as Blob groups from the next turn
     * on; no announcement keeps the default MediaSource path.
     */
    setAudioFormat(audio?: Partial<VoiceAudioFormat> | null): void {
        this.sink = chooseCallAudioSink(audio)
    }

    /**
     * How much of `turnId` (default: the active turn) has played, in ms; null when
     * that turn is not the active one. Covers every Blob group of the turn.
     */
    playedMs(turnId?: string): number | null {
        if (!this.activeTurnId || (turnId !== undefined && turnId !== this.activeTurnId)) return null
        // Between Blob groups the element still holds the last group's end time: counted already.
        const audible = this.mode === 'media_source' || this.groupActive
        const current = this.elementOwner === 'turn' && this.hasPlayed && audible ? this.elementTimeMs() : 0
        return Math.max(0, Math.round(this.playedBeforeGroupMs + current))
    }

    startTurn(voiceSessionId: string, turnId: string): void {
        // Idempotent for the active turn: its first chunk may have started it already.
        if (this.isCancelled(voiceSessionId, turnId) || this.isActiveTurn(voiceSessionId, turnId)) return
        this.attachElementListeners()
        this.cancelActiveTurn()
        this.activeVoiceSessionId = voiceSessionId
        this.activeTurnId = turnId
        this.setupMediaSource()
    }

    /** Queues one chunk. Returns true only when accepted (false for cancelled turns and stale or duplicate seqs). */
    appendChunk(frame: VoiceAudioChunkFrame): boolean {
        const { voice_session_id: voiceSessionId, turn_id: turnId, seq } = frame
        if (this.isCancelled(voiceSessionId, turnId) || !Number.isInteger(seq) || seq < 1) return false
        if (!isPlayableCallChunk(frame)) {
            this.reportUnsupported(voiceSessionId, turnId)
            return false
        }
        const active = this.isActiveTurn(voiceSessionId, turnId)
        if (active) {
            if (this.turnFinished || (this.finalSeq !== null && seq > this.finalSeq)) return false
            if (seq < this.expectedSeq || this.pendingChunks.has(seq)) return false
        }
        let bytes: Uint8Array
        try {
            bytes = decodeBase64(frame.data_b64)
        } catch {
            return false
        }

        if (!active) this.startTurn(voiceSessionId, turnId)
        this.applyTurnGain(frame)
        this.pendingChunks.set(seq, bytes)
        this.drainInOrder()
        if (this.currentState.status === 'idle' || !this.isStateOfActiveTurn()) this.setState('buffering')
        this.pump()
        if (this.hasPlayableSource()) void this.playIfAllowed()
        return true
    }

    finalize(frame: VoiceAudioFinalFrame): void {
        if (!this.isActiveTurn(frame.voice_session_id, frame.turn_id) || this.finalSeq !== null) return
        this.finalSeq = Math.max(0, frame.last_seq)
        for (const seq of [...this.pendingChunks.keys()]) {
            if (seq > this.finalSeq) this.pendingChunks.delete(seq)
        }
        // Fallback: flushes the remainder (partial frame included) once the current group ends.
        this.pump()
    }

    cancel(frame?: VoiceCancelledFrame | { voice_session_id?: string; turn_id?: string }): void {
        const voiceSessionId = frame?.voice_session_id ?? this.activeVoiceSessionId
        const turnId = frame?.turn_id ?? this.activeTurnId
        if (voiceSessionId && turnId) this.rememberCancelled(voiceSessionId, turnId)
        // A cancel naming another (older) turn must not stop the one playing now.
        if (frame?.turn_id && voiceSessionId && !this.isActiveTurn(voiceSessionId, frame.turn_id)) return
        this.cancelActiveTurn()
    }

    /**
     * Call synchronously inside a user gesture (before any await). Plays a tiny silent clip
     * on this same element — muted, then unmuted — so later programmatic play() is allowed
     * (iOS Safari's capture-time autoplay exemption covers MediaStream media only, not
     * MSE/Blob audio). If a turn is already waiting on the element, plays it instead.
     */
    unlock(): void {
        if (this.unlocked) return
        this.attachElementListeners()
        this.unlocked = true
        if (this.hasPlayableSource()) {
            void this.playIfAllowed(true)
            return
        }
        if (this.elementOwner === 'priming') return

        const audio = this.audio
        this.sourceToken += 1
        const token = this.sourceToken
        this.elementOwner = 'priming'
        const wasMuted = audio.muted
        audio.muted = true
        audio.src = silentWavDataUri()
        let result: Promise<void> | undefined
        try {
            result = audio.play()
        } catch (error) {
            result = Promise.reject(error)
        }
        audio.muted = wasMuted

        const settle = (error?: unknown) => {
            if (errorName(error) === 'NotAllowedError') this.unlocked = false
            // A turn may have taken the element over meanwhile; leave it alone then.
            if (this.elementOwner !== 'priming' || this.sourceToken !== token) return
            this.elementOwner = null
            try {
                audio.pause()
            } catch {
                // ignore
            }
            audio.removeAttribute('src')
        }
        if (result && typeof result.then === 'function') result.then(() => settle(), settle)
        else settle()
    }

    /** Retries playback from a user gesture (after `blocked`). Resolves true when playing. */
    resume(): Promise<boolean> {
        this.attachElementListeners()
        if (!this.hasPlayableSource()) {
            this.unlock()
            return Promise.resolve(false)
        }
        this.unlocked = true
        return this.playIfAllowed(true)
    }

    dispose(): void {
        this.cancelActiveTurn()
        // Reversible: a reused instance (React StrictMode remount) re-attaches on next use.
        this.detachElementListeners()
    }

    /**
     * `gain_db` is per voice, so the turn's first non-null `gain_db` sets the
     * element volume for the rest of the turn (D16); the read resets at each turn
     * start. A chunk without one (an older BFF build) restores full volume left
     * over from an earlier turn, so such turns play at full volume.
     */
    private applyTurnGain(frame: VoiceAudioChunkFrame): void {
        if (this.turnGainRead) return
        if (clipGainDb(frame.gain_db) !== null) {
            this.turnGainRead = true
            this.audio.volume = clipVolume(1, frame.gain_db, 'speech')
            this.gainApplied = true
        } else if (this.gainApplied) {
            this.audio.volume = 1
            this.gainApplied = false
        }
    }

    private reportUnsupported(voiceSessionId: string, turnId: string): void {
        const key = turnKey(voiceSessionId, turnId)
        if (this.unsupportedTurns.has(key)) return
        this.unsupportedTurns.add(key)
        if (this.unsupportedTurns.size > MAX_REMEMBERED_CANCELLED_TURNS) {
            const oldest = this.unsupportedTurns.values().next().value
            if (oldest !== undefined) this.unsupportedTurns.delete(oldest)
        }
        try {
            this.onUnsupportedFormat?.(turnId, voiceSessionId)
        } catch (error) {
            console.error('[voice-call][PLAYBACK] unsupported-format listener failed', error)
        }
    }

    private elementTimeMs(): number {
        const seconds = this.audio.currentTime
        return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
    }

    private setupMediaSource(): void {
        if (this.sink === 'blob') {
            this.mode = 'fallback'
            return
        }
        const resolved = resolveMediaSource()
        if (!resolved) {
            this.mode = 'fallback'
            return
        }
        let mediaSource: ManagedMediaSourceLike
        try {
            mediaSource = new resolved.MediaSource()
        } catch {
            this.mode = 'fallback'
            return
        }
        this.mode = 'media_source'
        this.managed = resolved.managed
        this.mediaSource = mediaSource
        if (resolved.managed) {
            // ManagedMediaSource never fires `sourceopen` unless remote playback (AirPlay) is
            // disabled. It also signals when it wants data (startstreaming/endstreaming); it
            // may evict buffered data under memory pressure, which a short reply never hits.
            this.audio.disableRemotePlayback = true
            mediaSource.addEventListener('startstreaming', this.onStartStreaming)
        }
        this.objectUrl = URL.createObjectURL(mediaSource)
        this.assignTurnSource(this.objectUrl)
        const open = () => {
            if (this.mediaSource !== mediaSource || this.sourceBuffer) return
            try {
                this.sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
            } catch {
                this.switchToFallback(true)
                return
            }
            this.sourceBuffer.addEventListener('updateend', this.onUpdateEnd)
            this.pump()
        }
        mediaSource.addEventListener('sourceopen', open, { once: true })
        if (mediaSource.readyState === 'open') open()
    }

    private drainInOrder(): void {
        while (this.pendingChunks.has(this.expectedSeq)) {
            const bytes = this.pendingChunks.get(this.expectedSeq)!
            this.pendingChunks.delete(this.expectedSeq)
            this.expectedSeq += 1
            this.queue.push(bytes)
            if (this.mode === 'media_source') this.turnBytes.push(bytes)
        }
    }

    /** Moves queued bytes toward the element: the next SourceBuffer append, or the next Blob group. */
    private pump(): void {
        if (!this.activeTurnId || this.turnFinished) return
        if (this.mode === 'fallback') {
            if (!this.groupActive) this.startNextGroup()
            return
        }
        const mediaSource = this.mediaSource
        const sourceBuffer = this.sourceBuffer
        if (!mediaSource || !sourceBuffer || sourceBuffer.updating) return
        if (this.queue.length === 0) {
            this.endMediaSourceIfComplete()
            return
        }
        // ManagedMediaSource: append only while the UA asks for data; `startstreaming` re-pumps.
        if (this.managed && mediaSource.streaming === false) return
        const next = this.queue.shift()!
        // Count before appending: a synchronous `updateend` re-enters pump().
        this.appendedCount += 1
        try {
            sourceBuffer.appendBuffer(toArrayBuffer(next))
        } catch {
            this.appendedCount -= 1
            this.queue.unshift(next)
            this.switchToFallback(false)
            return
        }
        this.armManagedStallTimer()
    }

    private endMediaSourceIfComplete(): void {
        const mediaSource = this.mediaSource
        if (this.mode !== 'media_source' || !mediaSource || !this.allReceived()) return
        if (this.queue.length > 0 || this.sourceBuffer?.updating) return
        // A turn without audio: no `ended` will ever fire.
        if (this.appendedCount === 0) {
            this.finishTurn()
            return
        }
        if (mediaSource.readyState === 'open') {
            try {
                mediaSource.endOfStream()
            } catch {
                // ignore finalization races
            }
        }
    }

    /** Fallback: plays everything queued since the last group as one Blob, never while one is playing. */
    private startNextGroup(): void {
        if (this.groupActive || !this.activeTurnId || this.turnFinished || !canCreateObjectUrl()) return
        const complete = this.allReceived()
        if (this.queue.length === 0) {
            if (complete) this.finishTurn()
            return
        }
        const bytes = concatBytes(this.queue)
        // Mid-turn, play whole MP3 frames only; the partial tail waits for the next group.
        const cut = complete ? bytes.length : completeMp3Length(bytes)
        if (cut <= 0) return
        this.queue = cut < bytes.length ? [bytes.subarray(cut)] : []
        this.revokeObjectUrl()
        this.objectUrl = URL.createObjectURL(new Blob([toArrayBuffer(bytes.subarray(0, cut))], { type: 'audio/mpeg' }))
        this.groupActive = true
        this.assignTurnSource(this.objectUrl)
        void this.playIfAllowed()
    }

    /**
     * Leaves the MediaSource path for the rest of the turn. If nothing was audible yet, the
     * whole turn replays as Blob groups. If the element already played some of it (an append
     * failed mid-reply), the buffered part plays out first (`elementStopped` false) and the
     * remaining bytes follow as Blob groups.
     */
    private switchToFallback(elementStopped: boolean): void {
        if (this.mode !== 'media_source') return
        const mediaSource = this.mediaSource
        const replayAll = !this.hasPlayed
        this.clearStallTimer()
        this.detachMediaSource()
        this.mode = 'fallback'
        this.managed = false
        if (replayAll) this.queue = this.turnBytes.slice()
        this.turnBytes = []
        // What the element already played of the turn still counts toward `playedMs`.
        if (!replayAll && elementStopped) this.playedBeforeGroupMs += this.elementTimeMs()
        if (replayAll || elementStopped) {
            this.releaseElementSource()
            this.groupActive = false
            this.startNextGroup()
            return
        }
        this.groupActive = true
        if (mediaSource?.readyState === 'open') {
            try {
                mediaSource.endOfStream()
            } catch {
                // ignore
            }
        }
    }

    private playIfAllowed(force = false): Promise<boolean> {
        if ((!this.autoPlay && !force) || !this.hasPlayableSource()) return Promise.resolve(false)
        const token = this.sourceToken
        this.playRequested = true
        this.armManagedStallTimer()
        claimAudioFocus(this.audio)
        let result: Promise<void> | undefined
        try {
            result = this.audio.play()
        } catch (error) {
            this.handlePlayRejected(error, token)
            return Promise.resolve(false)
        }
        if (!result || typeof result.then !== 'function') return Promise.resolve(true)
        return result.then(() => {
            // play() resolves once playback has actually started.
            if (token === this.sourceToken && this.hasPlayableSource()) this.markPlaying()
            return true
        }, (error: unknown) => {
            this.handlePlayRejected(error, token)
            return false
        })
    }

    private handlePlayRejected(error: unknown, token: number): void {
        if (token !== this.sourceToken || this.elementOwner !== 'turn' || this.turnFinished || !this.activeTurnId) return
        const name = errorName(error)
        if (name === 'NotAllowedError') {
            // Autoplay policy: surface it so the UI can offer a tap-to-listen (resume()).
            this.clearStallTimer()
            this.setState('blocked')
            return
        }
        if (name === 'NotSupportedError' && this.mode === 'media_source' && !this.hasPlayed) {
            this.switchToFallback(true)
        }
        // AbortError: a newer load/pause superseded this play() — nothing to surface.
    }

    private handlePlaying(): void {
        if (this.elementOwner !== 'turn' || !this.activeTurnId || this.turnFinished) return
        this.markPlaying()
    }

    private handleEnded(): void {
        if (this.elementOwner !== 'turn' || !this.activeTurnId || this.turnFinished) return
        releaseAudioFocus(this.audio)
        if (this.mode === 'fallback') {
            this.playedBeforeGroupMs += this.elementTimeMs()
            this.groupActive = false
            this.startNextGroup()
            return
        }
        if (this.allReceived()) this.finishTurn()
    }

    private handleElementError(): void {
        if (this.elementOwner !== 'turn' || !this.activeTurnId || this.turnFinished) return
        if (this.mode === 'media_source') {
            this.switchToFallback(true)
            return
        }
        // This group couldn't be decoded: move on to whatever arrived since.
        this.groupActive = false
        this.startNextGroup()
    }

    private markPlaying(): void {
        this.hasPlayed = true
        this.clearStallTimer()
        this.setState('playing')
    }

    private finishTurn(): void {
        if (this.turnFinished) return
        this.turnFinished = true
        this.clearStallTimer()
        releaseAudioFocus(this.audio)
        this.setState('idle')
    }

    private armManagedStallTimer(): void {
        if (!this.managed || this.mode !== 'media_source' || this.stallTimer || this.hasPlayed) return
        // Armed from the first received chunk, not the first append: a source that never
        // opens or never asks for data (`startstreaming`) appends nothing and would stay silent.
        if (!this.playRequested || this.turnBytes.length === 0 || this.currentState.status === 'blocked') return
        this.stallTimer = setTimeout(() => {
            this.stallTimer = null
            if (!this.managed || this.mode !== 'media_source' || this.hasPlayed || this.currentState.status === 'blocked') return
            console.warn('[voice-call][PLAYBACK] ManagedMediaSource never started playing; using Blob playback for this turn')
            this.switchToFallback(true)
        }, MANAGED_STALL_MS)
    }

    private clearStallTimer(): void {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer)
            this.stallTimer = null
        }
    }

    private cancelActiveTurn(): void {
        if (this.activeVoiceSessionId && this.activeTurnId) this.rememberCancelled(this.activeVoiceSessionId, this.activeTurnId)
        this.resetActivePlayback()
    }

    private resetActivePlayback(): void {
        const voiceSessionId = this.activeVoiceSessionId
        const turnId = this.activeTurnId
        this.clearStallTimer()
        this.detachMediaSource()
        this.pendingChunks.clear()
        this.queue = []
        this.turnBytes = []
        this.appendedCount = 0
        this.finalSeq = null
        this.expectedSeq = 1
        this.groupActive = false
        this.hasPlayed = false
        this.playRequested = false
        this.turnFinished = false
        this.turnGainRead = false
        this.playedBeforeGroupMs = 0
        this.mode = 'fallback'
        this.managed = false
        this.releaseElementSource()
        this.activeVoiceSessionId = null
        this.activeTurnId = null
        if (this.currentState.status !== 'idle') this.setState('idle', voiceSessionId, turnId)
    }

    /** Stops and empties the element if a turn owns it (never touches the unlock primer). */
    private releaseElementSource(): void {
        if (this.elementOwner === 'turn') {
            this.elementOwner = null
            this.sourceToken += 1
            try {
                this.audio.pause()
            } catch {
                // ignore
            }
            this.audio.removeAttribute('src')
            releaseAudioFocus(this.audio)
        }
        this.revokeObjectUrl()
    }

    private detachMediaSource(): void {
        this.sourceBuffer?.removeEventListener('updateend', this.onUpdateEnd)
        this.mediaSource?.removeEventListener('startstreaming', this.onStartStreaming)
        this.sourceBuffer = null
        this.mediaSource = null
    }

    private assignTurnSource(url: string): void {
        this.elementOwner = 'turn'
        this.sourceToken += 1
        this.audio.src = url
    }

    private attachElementListeners(): void {
        if (this.elementListenersAttached) return
        this.elementListenersAttached = true
        this.audio.addEventListener('play', this.onPlay)
        this.audio.addEventListener('pause', this.onPause)
        this.audio.addEventListener('playing', this.onPlaying)
        this.audio.addEventListener('waiting', this.onWaiting)
        this.audio.addEventListener('stalled', this.onStalled)
        this.audio.addEventListener('ended', this.onEnded)
        this.audio.addEventListener('error', this.onError)
    }

    private detachElementListeners(): void {
        if (!this.elementListenersAttached) return
        this.elementListenersAttached = false
        this.audio.removeEventListener('play', this.onPlay)
        this.audio.removeEventListener('pause', this.onPause)
        this.audio.removeEventListener('playing', this.onPlaying)
        this.audio.removeEventListener('waiting', this.onWaiting)
        this.audio.removeEventListener('stalled', this.onStalled)
        this.audio.removeEventListener('ended', this.onEnded)
        this.audio.removeEventListener('error', this.onError)
    }

    private emitMediaEvent(type: VoicePlaybackMediaEvent['type']): void {
        if (this.mediaListeners.size === 0 || this.elementOwner !== 'turn' || this.turnFinished) return
        const voiceSessionId = this.activeVoiceSessionId
        const turnId = this.activeTurnId
        if (!voiceSessionId || !turnId) return
        const event: VoicePlaybackMediaEvent = { type, voiceSessionId, turnId }
        for (const listener of [...this.mediaListeners]) {
            try {
                listener(event)
            } catch (error) {
                console.error('[voice-call][PLAYBACK] media listener failed', error)
            }
        }
    }

    private setState(status: VoicePlaybackState['status'], voiceSessionId = this.activeVoiceSessionId, turnId = this.activeTurnId): void {
        const previous = this.currentState
        if (previous.status === status && previous.voiceSessionId === voiceSessionId && previous.turnId === turnId) return
        this.currentState = { status, voiceSessionId, turnId }
        for (const listener of [...this.listeners]) {
            try {
                listener(this.currentState)
            } catch (error) {
                console.error('[voice-call][PLAYBACK] state listener failed', error)
            }
        }
    }

    private hasPlayableSource(): boolean {
        return this.elementOwner === 'turn'
            && this.activeTurnId !== null
            && !this.turnFinished
            && (this.mode === 'media_source' || this.groupActive)
    }

    private allReceived(): boolean {
        return this.finalSeq !== null && this.expectedSeq > this.finalSeq
    }

    private isStateOfActiveTurn(): boolean {
        return this.currentState.voiceSessionId === this.activeVoiceSessionId && this.currentState.turnId === this.activeTurnId
    }

    private rememberCancelled(voiceSessionId: string, turnId: string): void {
        this.cancelledTurns.add(turnKey(voiceSessionId, turnId))
        if (this.cancelledTurns.size > MAX_REMEMBERED_CANCELLED_TURNS) {
            const oldest = this.cancelledTurns.values().next().value
            if (oldest !== undefined) this.cancelledTurns.delete(oldest)
        }
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

/** The MediaSource constructor to use — feature-detected on the constructor itself. */
function resolveMediaSource(): { MediaSource: new () => ManagedMediaSourceLike; managed: boolean } | null {
    if (!canCreateObjectUrl()) return null
    if (typeof MediaSource !== 'undefined' && typeof MediaSource.isTypeSupported === 'function' && MediaSource.isTypeSupported('audio/mpeg')) {
        return { MediaSource, managed: false }
    }
    const Managed = (globalThis as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource
    if (Managed && typeof Managed.isTypeSupported === 'function' && Managed.isTypeSupported('audio/mpeg')) {
        return { MediaSource: Managed, managed: true }
    }
    return null
}

function canCreateObjectUrl(): boolean {
    return typeof URL !== 'undefined'
        && typeof URL.createObjectURL === 'function'
        && typeof URL.revokeObjectURL === 'function'
}

function errorName(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : undefined
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

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
    if (chunks.length === 1) return chunks[0]
    const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return out
}

const MPEG1_LAYER3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const MPEG2_LAYER3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const MPEG_SAMPLE_RATES: Record<number, readonly number[]> = {
    3: [44_100, 48_000, 32_000], // MPEG-1
    2: [22_050, 24_000, 16_000], // MPEG-2
    0: [11_025, 12_000, 8_000], // MPEG-2.5
}

/** Byte length of the MPEG layer III frame at `offset`: >0 length, 0 header incomplete, -1 not a frame. */
function mp3FrameLengthAt(bytes: Uint8Array, offset: number): number {
    const available = bytes.length - offset
    if (available < 1) return 0
    if (bytes[offset] !== 0xff) return -1
    if (available < 2) return 0
    const b1 = bytes[offset + 1]
    if ((b1 & 0xe0) !== 0xe0) return -1
    if (available < 3) return 0
    const version = (b1 >> 3) & 0x03
    const layer = (b1 >> 1) & 0x03
    const b2 = bytes[offset + 2]
    const bitrateIndex = b2 >> 4
    const sampleRateIndex = (b2 >> 2) & 0x03
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return -1
    const mpeg1 = version === 3
    const kbps = (mpeg1 ? MPEG1_LAYER3_KBPS : MPEG2_LAYER3_KBPS)[bitrateIndex]
    const sampleRate = MPEG_SAMPLE_RATES[version][sampleRateIndex]
    const padding = (b2 >> 1) & 0x01
    return Math.floor(((mpeg1 ? 144 : 72) * kbps * 1000) / sampleRate) + padding
}

/**
 * Length of the leading run of whole MP3 frames (after an optional ID3v2 tag). A Blob group
 * cut mid-frame loses that frame on both sides of the cut, so the tail waits for the next
 * group. Returns the full length for data that doesn't parse as MPEG layer III.
 */
function completeMp3Length(bytes: Uint8Array): number {
    let offset = 0
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        if (bytes.length < 10) return 0
        const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
        offset = 10 + size + ((bytes[5] & 0x10) !== 0 ? 10 : 0)
        if (offset > bytes.length) return 0
    }
    while (offset < bytes.length) {
        const length = mp3FrameLengthAt(bytes, offset)
        if (length < 0) return bytes.length
        if (length === 0 || offset + length > bytes.length) return offset
        offset += length
    }
    return offset
}

let silentWavUri: string | null = null

/** ~10 ms of 8 kHz 8-bit mono silence as a data URI (the autoplay-unlock primer). */
function silentWavDataUri(): string {
    if (silentWavUri) return silentWavUri
    const sampleCount = 80
    const bytes = new Uint8Array(44 + sampleCount)
    const view = new DataView(bytes.buffer)
    const ascii = (offset: number, text: string) => {
        for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index)
    }
    ascii(0, 'RIFF')
    view.setUint32(4, 36 + sampleCount, true)
    ascii(8, 'WAVE')
    ascii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, 8_000, true)
    view.setUint32(28, 8_000, true)
    view.setUint16(32, 1, true)
    view.setUint16(34, 8, true)
    ascii(36, 'data')
    view.setUint32(40, sampleCount, true)
    bytes.fill(0x80, 44) // 8-bit PCM silence is the midpoint
    silentWavUri = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
    return silentWavUri
}
