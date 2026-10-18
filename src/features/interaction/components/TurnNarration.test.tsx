import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatTtsSegmentClip } from '../../../shared'
import { AudioPlaylistContext, type AudioPlaylistContextValue } from '../../../app/providers/audioPlaylistContext'
import { apiService } from '../../../infrastructure/api'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { TurnNarration } from './TurnNarration'

/** A media element whose playback the test drives: jsdom implements none of it. */
class FakeAudio extends EventTarget {
    static instances: FakeAudio[] = []
    volume = 1
    paused = true
    ended = false
    play = vi.fn(() => {
        this.paused = false
        this.ended = false
        this.dispatchEvent(new Event('play'))
        this.dispatchEvent(new Event('playing'))
        return Promise.resolve()
    })
    pause = vi.fn(() => {
        if (this.paused) return
        this.paused = true
        this.dispatchEvent(new Event('pause'))
    })
    private source = ''

    constructor(src?: string) {
        super()
        if (src) this.source = src
        FakeAudio.instances.push(this)
    }

    get src() {
        return this.source
    }

    set src(value: string) {
        this.source = value
        this.paused = true
        this.ended = false
    }

    getAttribute(name: string) {
        return name === 'src' && this.source ? this.source : null
    }

    /** The clip plays out: the element fires `pause` (with `ended` set) and then `ended`. */
    finish() {
        this.paused = true
        this.ended = true
        this.dispatchEvent(new Event('pause'))
        this.dispatchEvent(new Event('ended'))
    }
}

const PLAY = 'Play narration'
const PAUSE = 'Pause narration'

function clip(segment_index: number, extra: Partial<ChatTtsSegmentClip> = {}): ChatTtsSegmentClip {
    return { segment_index, status: 'completed', url: `/tts/assets/asset-${segment_index}.mp3`, ...extra }
}

function failedClip(segment_index: number, extra: Partial<ChatTtsSegmentClip> = {}): ChatTtsSegmentClip {
    return { segment_index, status: 'failed', error: { category: 'failed', detail: 'Narration failed.' }, ...extra }
}

function playlist(volume: number, muted = false) {
    return function PlaylistWrapper({ children }: { children: ReactNode }) {
        const value = { volume, muted } as AudioPlaylistContextValue
        return <AudioPlaylistContext.Provider value={value}>{children}</AudioPlaylistContext.Provider>
    }
}

/** The element currently holding a clip (the multi-clip player reuses one). */
function element(): FakeAudio {
    const audio = FakeAudio.instances[FakeAudio.instances.length - 1]
    if (!audio) throw new Error('no audio element yet')
    return audio
}

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
let fetchBlob: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    FakeAudio.instances = []
    vi.stubGlobal('Audio', FakeAudio)
    let next = 0
    URL.createObjectURL = vi.fn(() => `blob:clip-${++next}`)
    URL.revokeObjectURL = vi.fn()
    fetchBlob = vi.spyOn(apiService, 'fetchTtsAudioBlob').mockImplementation(async (url: string) => new Blob([url]))
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
})

describe('TurnNarration multi-clip player', () => {
    it('skips a failed clip and keeps playing the rest of the turn (D30 #3)', async () => {
        const segments = [
            clip(0, { kind: 'narrator' }),
            failedClip(1, { kind: 'speech', speaker_name: 'Brom' }),
            clip(2, { kind: 'speech', speaker_name: 'Lyra' }),
        ]
        render(<TurnNarration segments={segments} canRequest={false} onRequest={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalledTimes(1))
        expect(fetchBlob).toHaveBeenLastCalledWith(expect.stringContaining('/tts/assets/asset-0.mp3'))
        expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument()
        expect(screen.getByText('Narrator · 1/3')).toBeInTheDocument()

        act(() => element().finish())
        await waitFor(() => expect(element().play).toHaveBeenCalledTimes(2))
        expect(fetchBlob).toHaveBeenLastCalledWith(expect.stringContaining('/tts/assets/asset-2.mp3'))
        expect(fetchBlob).toHaveBeenCalledTimes(2)
        expect(screen.getByText('Lyra · 3/3')).toBeInTheDocument()
        expect(screen.getByText(/1 clip skipped/)).toBeInTheDocument()

        act(() => element().finish())
        expect(screen.getByRole('button', { name: PLAY })).toBeInTheDocument()
    })

    it('never leaves the pause button stuck when another surface pauses the clip (D30 #2)', async () => {
        render(<TurnNarration segments={[clip(0), clip(1)]} canRequest onRequest={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument())

        // Audio focus moved elsewhere: the element is paused without our button.
        act(() => element().pause())
        expect(screen.getByRole('button', { name: PLAY })).toBeInTheDocument()

        // Play resumes the same clip on the same element, without a refetch.
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument()
        expect(element().play).toHaveBeenCalledTimes(2)
        expect(fetchBlob).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: PAUSE }))
        expect(element().paused).toBe(true)
        expect(screen.getByRole('button', { name: PLAY })).toBeInTheDocument()
    })

    it('sets each clip’s volume from the playlist, its voice gain and the thought factor (D16)', async () => {
        const segments = [
            clip(0, { kind: 'speech', gain_db: -6 }),
            clip(1, { kind: 'thought', gain_db: -6 }),
            clip(2, { kind: 'narrator' }),
        ]
        render(<TurnNarration segments={segments} canRequest onRequest={vi.fn()} />, { wrapper: playlist(0.5) })

        const gain = 10 ** (-6 / 20)
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalledTimes(1))
        expect(element().volume).toBeCloseTo(0.5 * gain, 5)

        act(() => element().finish())
        await waitFor(() => expect(element().play).toHaveBeenCalledTimes(2))
        expect(element().volume).toBeCloseTo(0.5 * gain * 0.708, 5)

        // No gain on the wire: the playlist volume, unchanged.
        act(() => element().finish())
        await waitFor(() => expect(element().play).toHaveBeenCalledTimes(3))
        expect(element().volume).toBeCloseTo(0.5, 5)
    })

    it('follows the playlist mute', async () => {
        render(<TurnNarration segments={[clip(0, { gain_db: -3 })]} canRequest onRequest={vi.fn()} />, { wrapper: playlist(0.8, true) })
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalled())
        expect(element().volume).toBe(0)
    })

    it('offers a per-turn retry for retryable skips, labelled with the count', () => {
        const onRequest = vi.fn()
        render(<TurnNarration segments={[clip(0), failedClip(1), failedClip(2)]} canRequest onRequest={onRequest} />)

        expect(screen.getByText('AI voice')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry 2 skipped clips' }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('does not offer a retry for capped or blocked clips, and says why', () => {
        const segments = [
            clip(0),
            { segment_index: 1, status: 'daily_limit_reached' as const },
            failedClip(2, { error: { category: 'failed', detail: 'x', code: 'voice_unavailable' } }),
        ]
        render(<TurnNarration segments={segments} canRequest onRequest={vi.fn()} />)

        expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
        expect(screen.getByText('Daily voice limit reached. Narration resumes tomorrow.')).toBeInTheDocument()
    })

    it('plays stored clips but requests nothing when it cannot request (read-only)', async () => {
        const onRequest = vi.fn()
        render(<TurnNarration segments={[clip(0), failedClip(1)]} canRequest={false} onRequest={onRequest} />)

        expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalled())
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('hands an attestation refusal to onAttest instead of re-requesting', () => {
        const onRequest = vi.fn()
        const onAttest = vi.fn()
        const refusal = { category: 'failed', detail: 'x', code: 'attestation_required', action: 'attest' as const }
        render(<TurnNarration segments={[failedClip(0, { error: refusal })]} canRequest onRequest={onRequest} onAttest={onAttest} />)

        fireEvent.click(screen.getByRole('button', { name: 'Confirm your age and accept the terms to use voice features' }))
        expect(onAttest).toHaveBeenCalledOnce()
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('while narration is unavailable: stored clips still play, and no retry or attest is offered', async () => {
        const onRequest = vi.fn()
        const refusal = { category: 'failed', detail: 'x', code: 'attestation_required', action: 'attest' as const }
        render(<TurnNarration segments={[clip(0), failedClip(1), failedClip(2, { error: refusal })]} canRequest onRequest={onRequest} unavailable />)

        expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Confirm your age and accept the terms to use voice features' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalled())
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('while narration is unavailable and nothing is playable: a disabled control says why instead of a retry', () => {
        const onRequest = vi.fn()
        render(<TurnNarration segments={[failedClip(0), failedClip(1)]} canRequest onRequest={onRequest} unavailable />)

        const button = screen.getByRole('button', { name: 'Narration is unavailable right now' })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: /Retry|tap to retry/ })).toBeNull()
        fireEvent.click(button)
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('skips a clip whose audio cannot be loaded and offers to retry it', async () => {
        fetchBlob.mockImplementation(async (url: string) => {
            if (url.includes('asset-0')) throw new Error('network')
            return new Blob([url])
        })
        render(<TurnNarration segments={[clip(0), clip(1)]} canRequest onRequest={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(element().play).toHaveBeenCalled())
        expect(fetchBlob).toHaveBeenLastCalledWith(expect.stringContaining('asset-1'))
        expect(screen.getByRole('button', { name: 'Retry 1 skipped clip' })).toBeInTheDocument()
    })
})

describe('TurnNarration single clip', () => {
    it('plays a stored clip with the AI voice label even when it cannot request', async () => {
        render(<TurnNarration status="completed" url="/tts/assets/whole.mp3" canRequest={false} onRequest={vi.fn()} />, {
            wrapper: playlist(0.4),
        })

        expect(screen.getByText('AI voice')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument())
        expect(element().volume).toBeCloseTo(0.4, 5)

        act(() => element().pause())
        expect(screen.getByRole('button', { name: PLAY })).toBeInTheDocument()
    })

    it('shows a retry when the audio cannot be loaded', async () => {
        fetchBlob.mockRejectedValue(new Error('network'))
        render(<TurnNarration status="completed" url="/tts/assets/whole.mp3" canRequest onRequest={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        const retry = await screen.findByRole('button', { name: 'Couldn’t load narration — tap to retry' })
        fetchBlob.mockImplementation(async (url: string) => new Blob([url]))
        fireEvent.click(retry)
        await waitFor(() => expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument())
    })

    it('plays a stored clip while narration is unavailable', async () => {
        const onRequest = vi.fn()
        render(<TurnNarration status="completed" url="/tts/assets/whole.mp3" canRequest onRequest={onRequest} unavailable />)

        const play = screen.getByRole('button', { name: PLAY })
        expect(play).toBeEnabled()
        fireEvent.click(play)
        await waitFor(() => expect(screen.getByRole('button', { name: PAUSE })).toBeInTheDocument())
        expect(onRequest).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Narration is unavailable right now' })).toBeNull()
    })

    it('shows a disabled, labelled control instead of a request or retry while narration is unavailable', () => {
        const onRequest = vi.fn()
        render(<TurnNarration status="failed" error={{ category: 'failed', detail: 'raw' }} canRequest onRequest={onRequest} unavailable />)

        const button = screen.getByRole('button', { name: 'Narration is unavailable right now' })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: /tap to retry/ })).toBeNull()
        fireEvent.click(button)
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('renders nothing to request when it cannot request and has no audio', () => {
        const { container } = render(<TurnNarration canRequest={false} onRequest={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('uses known error copy and opens the attestation for an attest refusal', () => {
        const onAttest = vi.fn()
        const { rerender } = render(
            <TurnNarration
                status="failed"
                error={{ category: 'failed', detail: 'raw', code: 'voice_unavailable' }}
                canRequest
                onRequest={vi.fn()}
            />,
        )
        expect(screen.getByRole('button', { name: 'Narration failed — tap to retry: This voice isn’t available right now.' })).toBeInTheDocument()

        rerender(
            <TurnNarration
                status="failed"
                error={{ category: 'failed', detail: 'raw', code: 'attestation_required', action: 'attest' }}
                canRequest
                onRequest={vi.fn()}
                onAttest={onAttest}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Confirm your age and accept the terms to use voice features' }))
        expect(onAttest).toHaveBeenCalledOnce()
    })
})

describe('TurnNarration voice notes (R1-FE-04)', () => {
    beforeEach(() => {
        installVoiceNarrationCopy()
    })

    it('keeps the AI voice label in every playable state, with or without notes (P-10)', () => {
        const { rerender } = render(<TurnNarration segments={[clip(0)]} canRequest={false} onRequest={vi.fn()} />)
        expect(screen.getByText('AI voice')).toBeInTheDocument()
        expect(screen.queryByTestId('narration-voice-notes')).toBeNull()
        rerender(<TurnNarration segments={[clip(0, { substitution_reason: 'tier_fallback' })]} canRequest onRequest={vi.fn()} />)
        expect(screen.getByText('AI voice')).toBeInTheDocument()
        expect(screen.getByText('Standard voice')).toBeInTheDocument()
        rerender(<TurnNarration segments={[clip(0, { kind: 'speech', speaker_id: 'c1', substitution_reason: 'voice_removed' })]} canRequest onRequest={vi.fn()} refreshDisabled />)
        expect(screen.getByText('AI voice')).toBeInTheDocument()
        expect(screen.getByText('Voice replaced')).toBeInTheDocument()
        rerender(<TurnNarration url="/tts/assets/a.mp3" status="completed" canRequest={false} onRequest={vi.fn()} />)
        expect(screen.getByText('AI voice')).toBeInTheDocument()
    })

    it('passes the refresh target of a replaced speaker to onRefreshVoice', async () => {
        const onRefreshVoice = vi.fn().mockResolvedValue({})
        render(
            <TurnNarration
                segments={[clip(0, { kind: 'speech', speaker_id: 'c9', speaker_name: 'Rook', substitution_reason: 'voice_removed' })]}
                canRequest
                onRequest={vi.fn()}
                onRefreshVoice={onRefreshVoice}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Voice replaced/ }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Use the card’s current voice' }))
        await waitFor(() => expect(onRefreshVoice).toHaveBeenCalledWith({ speakerKind: 'speech', cardId: 'c9' }))
    })
})

describe('TurnNarration playing reports (break nudge)', () => {
    it('reports a single clip starting and stopping', async () => {
        const onPlayingChange = vi.fn()
        render(<TurnNarration status="completed" url="/tts/assets/whole.mp3" canRequest={false} onRequest={vi.fn()} onPlayingChange={onPlayingChange} />)
        expect(onPlayingChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(onPlayingChange).toHaveBeenLastCalledWith(true))
        act(() => element().pause())
        expect(onPlayingChange).toHaveBeenLastCalledWith(false)
    })

    it('reports a multi-clip turn while it plays, and false on unmount', async () => {
        const onPlayingChange = vi.fn()
        const { unmount } = render(<TurnNarration segments={[clip(0), clip(1)]} canRequest={false} onRequest={vi.fn()} onPlayingChange={onPlayingChange} />)
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        await waitFor(() => expect(onPlayingChange).toHaveBeenLastCalledWith(true))
        unmount()
        expect(onPlayingChange).toHaveBeenLastCalledWith(false)
    })
})

describe('TurnNarration refusals no retry lifts (safety pause, region block)', () => {
    const SAFETY = 'Voice is paused for now.'
    const REGION = 'Voice is not available in your region.'
    const refusal = (code: string) => ({ category: 'failed', detail: 'raw', code })

    it.each([
        ['voice_safety_pause', SAFETY],
        ['voice_region_unavailable', REGION],
    ])('single clip refused with %s: a disabled control says why, and clicking requests nothing', (code, copy) => {
        const onRequest = vi.fn()
        render(<TurnNarration status="failed" error={refusal(code)} canRequest onRequest={onRequest} />)

        const button = screen.getByRole('button', { name: copy })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: /tap to retry/ })).toBeNull()
        fireEvent.click(button)
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('single clip refused with content_blocked still offers the retry (R0 unchanged)', () => {
        const onRequest = vi.fn()
        render(<TurnNarration status="failed" error={refusal('content_blocked')} canRequest onRequest={onRequest} />)

        const retry = screen.getByRole('button', { name: /tap to retry/ })
        expect(retry).not.toBeDisabled()
        fireEvent.click(retry)
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('multi-clip with every clip safety-paused: a disabled control, no retry', () => {
        const onRequest = vi.fn()
        const segments = [failedClip(0, { error: refusal('voice_safety_pause') }), failedClip(1, { error: refusal('voice_safety_pause') })]
        render(<TurnNarration segments={segments} canRequest onRequest={onRequest} />)

        const button = screen.getByRole('button', { name: SAFETY })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: /Retry|tap to retry/ })).toBeNull()
        fireEvent.click(button)
        expect(onRequest).not.toHaveBeenCalled()
    })

    it('multi-clip refused for the turn and its clips (pause and region): a disabled control', () => {
        const segments = [failedClip(0, { error: refusal('voice_region_unavailable') }), failedClip(1, { error: refusal('voice_safety_pause') })]
        render(<TurnNarration segments={segments} error={refusal('voice_region_unavailable')} canRequest onRequest={vi.fn()} />)

        expect(screen.getByRole('button', { name: REGION })).toBeDisabled()
        expect(screen.queryByRole('button', { name: /Retry|tap to retry/ })).toBeNull()
    })

    it('multi-clip whose turn-level error is another code keeps today’s retry', () => {
        const onRequest = vi.fn()
        const segments = [failedClip(0, { error: refusal('voice_safety_pause') })]
        render(<TurnNarration segments={segments} error={refusal('voice_unavailable')} canRequest onRequest={onRequest} />)

        fireEvent.click(screen.getByRole('button', { name: /tap to retry/ }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('multi-clip mixing a safety-paused clip with a retryable one keeps the retry', () => {
        const onRequest = vi.fn()
        render(<TurnNarration segments={[failedClip(0, { error: refusal('voice_safety_pause') }), failedClip(1)]} canRequest onRequest={onRequest} />)

        expect(screen.queryByRole('button', { name: SAFETY })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /tap to retry/ }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('a playable turn mixing a safety-paused clip with a retryable one offers "Retry n" as today', () => {
        const onRequest = vi.fn()
        render(<TurnNarration segments={[clip(0), failedClip(1, { error: refusal('voice_safety_pause') }), failedClip(2)]} canRequest onRequest={onRequest} />)

        fireEvent.click(screen.getByRole('button', { name: 'Retry 1 skipped clip' }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('multi-clip refused for the turn whose clips carry no error: a disabled control, never a re-request', () => {
        const onRequest = vi.fn()
        // A terminal, non-retryable status and no clip error: only the turn says why.
        const segments: ChatTtsSegmentClip[] = [{ segment_index: 0, kind: 'narrator', status: 'invalid' }]
        render(<TurnNarration segments={segments} error={refusal('voice_safety_pause')} canRequest onRequest={onRequest} />)

        const button = screen.getByRole('button', { name: SAFETY })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
        fireEvent.click(button)
        expect(onRequest).not.toHaveBeenCalled()
    })
})

describe('TurnNarration timed safety pause (retry_after_seconds)', () => {
    const SAFETY = 'Voice is paused for now.'
    const REGION = 'Voice is not available in your region.'
    const refusal = (code: string, retry_after_seconds?: number | null) => ({ category: 'failed', detail: 'raw', code, retry_after_seconds })

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('single clip: refused while the pause lasts, then the plain request control (no stale paused copy)', () => {
        const onRequest = vi.fn()
        render(<TurnNarration status="failed" error={refusal('voice_safety_pause', 30)} canRequest onRequest={onRequest} />)

        expect(screen.getByRole('button', { name: SAFETY })).toBeDisabled()
        act(() => {
            vi.advanceTimersByTime(29_000)
        })
        expect(screen.getByRole('button', { name: SAFETY })).toBeDisabled()

        act(() => {
            vi.advanceTimersByTime(1_000)
        })
        expect(screen.queryByRole('button', { name: SAFETY })).toBeNull()
        expect(screen.queryByRole('button', { name: /tap to retry/ })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('a new refusal after the pause ran out holds again', () => {
        const { rerender } = render(<TurnNarration status="failed" error={refusal('voice_safety_pause', 5)} canRequest onRequest={vi.fn()} />)
        act(() => {
            vi.advanceTimersByTime(5_000)
        })
        expect(screen.getByRole('button', { name: PLAY })).not.toBeDisabled()

        rerender(<TurnNarration status="failed" error={refusal('voice_safety_pause', 5)} canRequest onRequest={vi.fn()} />)
        expect(screen.getByRole('button', { name: SAFETY })).toBeDisabled()
    })

    it.each([
        ['an open-ended safety pause', refusal('voice_safety_pause', null), SAFETY],
        ['a region block, even with retry_after_seconds', refusal('voice_region_unavailable', 30), REGION],
    ])('single clip: %s never lapses', (_label, error, copy) => {
        render(<TurnNarration status="failed" error={error} canRequest onRequest={vi.fn()} />)
        act(() => {
            vi.advanceTimersByTime(24 * 60 * 60_000)
        })
        expect(screen.getByRole('button', { name: copy })).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
    })

    it('multi-clip: refused while the pause lasts, then the plain request control re-requests the turn', () => {
        const onRequest = vi.fn()
        const segments = [
            failedClip(0, { error: refusal('voice_safety_pause', 10) }),
            failedClip(1, { error: refusal('voice_safety_pause', 20) }),
        ]
        render(<TurnNarration segments={segments} canRequest onRequest={onRequest} />)

        // The latest end wins.
        act(() => {
            vi.advanceTimersByTime(10_000)
        })
        expect(screen.getByRole('button', { name: SAFETY })).toBeDisabled()
        act(() => {
            vi.advanceTimersByTime(10_000)
        })
        expect(screen.queryByRole('button', { name: SAFETY })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: PLAY }))
        expect(onRequest).toHaveBeenCalledOnce()
    })

    it('narration switched off still wins over a lapsed pause', () => {
        render(<TurnNarration status="failed" error={refusal('voice_safety_pause', 1)} canRequest unavailable onRequest={vi.fn()} />)
        act(() => {
            vi.advanceTimersByTime(1_000)
        })
        expect(screen.getByTestId('narration-unavailable-button')).toBeDisabled()
        expect(screen.queryByRole('button', { name: PLAY })).toBeNull()
    })
})
