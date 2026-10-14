import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttestationContext, type AttestationContextValue } from '@/features/legal/attestation/attestationContext'
import {
    classifyPreviewError,
    clipTranscript,
    deriveFreePreviewsLeft,
    MAX_AUTO_RETRY_AFTER_SECONDS,
    previewAudioUrl,
    previewRequestBody,
    tokenBucketRetryDelayMs,
    useRecipePreview,
    type RecipePreviewInput,
} from './useRecipePreview'

const previewVoice = vi.fn()
const fetchProtectedMediaBlob = vi.fn()
const getUserProfile = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        previewVoice: (...a: unknown[]) => previewVoice(...a),
        fetchProtectedMediaBlob: (...a: unknown[]) => fetchProtectedMediaBlob(...a),
        getUserProfile: (...a: unknown[]) => getUserProfile(...a),
    },
}))

const VOICE_KEY = 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f'

const input: RecipePreviewInput = {
    voiceKey: VOICE_KEY,
    settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.1 },
    emotion: 'happy',
    textId: 'narration',
    language: 'en',
    tier: 'standard',
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

function httpError(status: number, code?: string, extra: Record<string, unknown> = {}) {
    return Object.assign(new Error(`HTTP ${status}`), { status, code, ...extra })
}

function profileWithPreviews(previews_left: number) {
    return { membership: { previews_left } }
}

let urls = 0

describe('useRecipePreview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        urls = 0
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:preview-${++urls}`), revokeObjectURL: vi.fn() })
        getUserProfile.mockResolvedValue(profileWithPreviews(3))
        fetchProtectedMediaBlob.mockImplementation(async (url: string) => new Blob([url], { type: 'audio/mpeg' }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('sends a fixed text id (never free text) and plays the authed blob', async () => {
        previewVoice.mockResolvedValue({ cache_key: 'abc123', url: '/voice-presets/preview/abc123.mp3', cached: false, previews_left: 2 })
        const { result } = renderHook(() => useRecipePreview())

        await waitFor(() => expect(result.current.previewsLeft).toBe(3))
        await act(() => result.current.run(input))

        const [body, options] = previewVoice.mock.calls[0] as [Record<string, unknown>, { signal: AbortSignal }]
        expect(body).toEqual({
            voice_key: VOICE_KEY,
            settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.1 },
            emotion: 'happy',
            text_id: 'narration',
            language: 'en',
            tier: 'standard',
        })
        expect(body).not.toHaveProperty('text')
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(fetchProtectedMediaBlob).toHaveBeenCalledWith('/voice-presets/preview/abc123.mp3', 'audio/mpeg')
        expect(result.current.status).toBe('ready')
        expect(result.current.clip).toMatchObject({ src: 'blob:preview-1', textId: 'narration', volume: 1, cached: false })
        expect(result.current.previewsLeft).toBe(2)
    })

    it('builds the audio path from cache_key when the response has no url', () => {
        expect(previewAudioUrl({ cache_key: 'k 1' })).toBe('/voice-presets/preview/k%201.mp3')
        expect(previewAudioUrl({ cache_key: '' })).toBeNull()
        expect(previewRequestBody({ ...input, settings: null, emotion: null })).toMatchObject({ settings: null, emotion: null })
    })

    it('ignores a late response once a newer preview started, and aborts the older request', async () => {
        const first = deferred<unknown>()
        previewVoice
            .mockImplementationOnce(() => first.promise)
            .mockResolvedValueOnce({ cache_key: 'second', previews_left: 1 })
        const { result } = renderHook(() => useRecipePreview())

        let firstRun!: Promise<void>
        act(() => {
            firstRun = result.current.run({ ...input, textId: 'dialogue' })
        })
        const firstSignal = (previewVoice.mock.calls[0][1] as { signal: AbortSignal }).signal
        await act(() => result.current.run(input))
        expect(firstSignal.aborted).toBe(true)

        // The superseded request answers late: nothing it carries is applied.
        await act(async () => {
            first.resolve({ cache_key: 'first', previews_left: 2 })
            await firstRun
        })

        expect(fetchProtectedMediaBlob).toHaveBeenCalledTimes(1)
        expect(fetchProtectedMediaBlob).toHaveBeenCalledWith('/voice-presets/preview/second.mp3', 'audio/mpeg')
        expect(result.current.clip).toMatchObject({ textId: 'narration' })
        expect(result.current.previewsLeft).toBe(1)
    })

    it('drops a late blob when the preview was stopped meanwhile', async () => {
        const blob = deferred<Blob>()
        previewVoice.mockResolvedValue({ cache_key: 'slow', previews_left: 2 })
        fetchProtectedMediaBlob.mockImplementationOnce(() => blob.promise)
        const { result } = renderHook(() => useRecipePreview())

        let run!: Promise<void>
        act(() => {
            run = result.current.run(input)
        })
        await waitFor(() => expect(fetchProtectedMediaBlob).toHaveBeenCalled())
        act(() => result.current.stop())
        await act(async () => {
            blob.resolve(new Blob(['late']))
            await run
        })

        expect(result.current.status).toBe('idle')
        expect(result.current.clip).toBeNull()
        expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('a daily-limit 429 sets the count to 0 without an inline error', async () => {
        previewVoice.mockRejectedValue(httpError(429))
        getUserProfile.mockResolvedValueOnce(profileWithPreviews(3)).mockResolvedValue(profileWithPreviews(0))
        const { result } = renderHook(() => useRecipePreview())
        await waitFor(() => expect(result.current.previewsLeft).toBe(3))

        await act(() => result.current.run(input))

        expect(result.current.previewsLeft).toBe(0)
        expect(result.current.limitReached).toBe(true)
        expect(result.current.problem).toBe('limitReached')
        expect(result.current.error).toBeNull()
        // The profile is read again so the server's count wins.
        await waitFor(() => expect(getUserProfile).toHaveBeenCalledTimes(2))
        expect(result.current.previewsLeft).toBe(0)
    })

    it('reconciles a 429 without a code with the count the profile reports', async () => {
        previewVoice.mockRejectedValue(httpError(429))
        getUserProfile.mockResolvedValueOnce(profileWithPreviews(3)).mockResolvedValue(profileWithPreviews(2))
        const { result } = renderHook(() => useRecipePreview())
        await waitFor(() => expect(result.current.previewsLeft).toBe(3))

        await act(() => result.current.run(input))

        await waitFor(() => expect(result.current.previewsLeft).toBe(2))
        expect(result.current.limitReached).toBe(false)
    })

    it('a 429 with Retry-After and no code keeps the count (token bucket)', async () => {
        previewVoice.mockRejectedValue(httpError(429, undefined, { retryAfterSeconds: 10 }))
        const { result } = renderHook(() => useRecipePreview())
        await waitFor(() => expect(result.current.previewsLeft).toBe(3))

        await act(() => result.current.run(input))

        expect(result.current.problem).toBe('rateLimited')
        expect(result.current.previewsLeft).toBe(3)
        expect(result.current.limitReached).toBe(false)
        expect(getUserProfile).toHaveBeenCalledTimes(1)
    })

    it('takes previews_left from a 429 error body', async () => {
        previewVoice
            .mockRejectedValueOnce(httpError(429, undefined, { details: { previews_left: 4 } }))
            .mockRejectedValueOnce(httpError(429, undefined, { details: { previews_left: 0 } }))
        const { result } = renderHook(() => useRecipePreview())
        await waitFor(() => expect(result.current.previewsLeft).toBe(3))

        await act(() => result.current.run(input))
        expect(result.current.problem).toBe('rateLimited')
        expect(result.current.previewsLeft).toBe(4)

        await act(() => result.current.run(input))
        expect(result.current.problem).toBe('limitReached')
        expect(result.current.previewsLeft).toBe(0)
    })

    it('a token-bucket 429 keeps the count and says to slow down', async () => {
        // No Retry-After: shown at once, never retried (the retry has its own suite below).
        previewVoice.mockRejectedValue(httpError(429, 'rate_limited'))
        const { result } = renderHook(() => useRecipePreview())
        await waitFor(() => expect(result.current.previewsLeft).toBe(3))

        await act(() => result.current.run(input))

        expect(result.current.previewsLeft).toBe(3)
        expect(result.current.error).toBe('Too many previews at once. Try again in a moment.')
    })

    it('maps 503 moderation_unavailable to the unavailable copy', async () => {
        previewVoice.mockRejectedValue(httpError(503, 'moderation_unavailable'))
        const { result } = renderHook(() => useRecipePreview())

        await act(() => result.current.run(input))

        expect(result.current.problem).toBe('unavailable')
        expect(result.current.error).toBe('Preview is temporarily unavailable.')
    })

    it('retries once through the attestation prompt on 428', async () => {
        previewVoice
            .mockRejectedValueOnce(httpError(428, 'attestation_required'))
            .mockResolvedValueOnce({ cache_key: 'after-attest', previews_left: 2 })
        const requestAttestation = vi.fn(async () => true)
        const withAttestation = vi.fn(async <T,>(operation: () => Promise<T>): Promise<T> => {
            try {
                return await operation()
            } catch (failure) {
                if ((failure as { status?: number }).status !== 428) throw failure
                if (!(await requestAttestation())) throw failure
                return operation()
            }
        })
        const value = { gate: 'unavailable', requestAttestation, withAttestation, expectSignupAttestation: vi.fn(), cancelSignupAttestation: vi.fn() } as unknown as AttestationContextValue
        const wrapper = ({ children }: { children: ReactNode }) => <AttestationContext.Provider value={value}>{children}</AttestationContext.Provider>
        const { result } = renderHook(() => useRecipePreview(), { wrapper })

        await act(() => result.current.run(input))

        expect(withAttestation).toHaveBeenCalledTimes(1)
        expect(requestAttestation).toHaveBeenCalledTimes(1)
        expect(previewVoice).toHaveBeenCalledTimes(2)
        expect(result.current.status).toBe('ready')
        expect(result.current.previewsLeft).toBe(2)
    })

    it('a declined attestation leaves the attestation copy', async () => {
        previewVoice.mockRejectedValue(httpError(428, 'attestation_required'))
        const requestAttestation = vi.fn(async () => false)
        const withAttestation = vi.fn(async <T,>(operation: () => Promise<T>): Promise<T> => {
            try {
                return await operation()
            } catch (failure) {
                if ((failure as { status?: number }).status !== 428) throw failure
                if (!(await requestAttestation())) throw failure
                return operation()
            }
        })
        const value = { gate: 'required', requestAttestation, withAttestation, expectSignupAttestation: vi.fn(), cancelSignupAttestation: vi.fn() } as unknown as AttestationContextValue
        const wrapper = ({ children }: { children: ReactNode }) => <AttestationContext.Provider value={value}>{children}</AttestationContext.Provider>
        const { result } = renderHook(() => useRecipePreview(), { wrapper })

        await act(() => result.current.run(input))

        expect(requestAttestation).toHaveBeenCalledTimes(1)
        // Declined: no retry.
        expect(previewVoice).toHaveBeenCalledTimes(1)
        expect(result.current.problem).toBe('attestation')
        expect(result.current.error).toBe('Confirm your age and accept the terms to use voice features')
    })

    it('plays thought previews at x0.708, times the voice gain when sent', async () => {
        previewVoice.mockResolvedValueOnce({ cache_key: 't1' }).mockResolvedValueOnce({ cache_key: 't2', gain_db: -6 })
        const { result } = renderHook(() => useRecipePreview())

        await act(() => result.current.run({ ...input, textId: 'thought' }))
        expect(result.current.clip?.volume).toBeCloseTo(0.708, 3)

        await act(() => result.current.run({ ...input, textId: 'thought' }))
        expect(result.current.clip?.volume).toBeCloseTo(0.708 * 10 ** (-6 / 20), 3)
        // The replaced clip's object URL is released.
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
    })

    it('keeps the count unknown when the profile has no usage fields, and does not seed while disabled', async () => {
        getUserProfile.mockResolvedValue({ membership: { plan_code: 'free' } })
        const { result, rerender } = renderHook(({ enabled }) => useRecipePreview({ enabled }), { initialProps: { enabled: false } })
        expect(getUserProfile).not.toHaveBeenCalled()

        rerender({ enabled: true })
        await waitFor(() => expect(getUserProfile).toHaveBeenCalledTimes(1))
        expect(result.current.previewsLeft).toBeNull()
        expect(result.current.limitReached).toBe(false)
    })

    it('tags the clip with the input key and language', async () => {
        previewVoice.mockResolvedValue({ cache_key: 'k' })
        const { result } = renderHook(() => useRecipePreview())

        await act(() => result.current.run({ ...input, key: 'preset-a', language: 'es' }))

        expect(result.current.clip).toMatchObject({ key: 'preset-a', language: 'es' })
    })

    it('reset forgets the clip and revokes its URL', async () => {
        previewVoice.mockResolvedValue({ cache_key: 'r1' })
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(input))

        act(() => result.current.reset())

        expect(result.current.clip).toBeNull()
        expect(result.current.status).toBe('idle')
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
    })
})

describe('classifyPreviewError', () => {
    it.each([
        [{ status: 428 }, 'attestation'],
        [{ status: 429 }, 'limitReached'],
        [{ status: 429, code: 'rate_limit_exceeded' }, 'rateLimited'],
        [{ status: 429, category: 'rate_limited' }, 'rateLimited'],
        [{ status: 429, retryAfterSeconds: 30 }, 'rateLimited'],
        [{ status: 429, code: 'daily_limit_reached', retryAfterSeconds: 3600 }, 'limitReached'],
        [{ status: 429, details: { previews_left: 0 } }, 'limitReached'],
        [{ status: 402 }, 'noCredits'],
        [{ status: 409, code: 'voice_unavailable' }, 'voiceUnavailable'],
        [{ status: 422, code: 'voice_v1_not_allowed' }, 'voiceUnavailable'],
        [{ status: 503 }, 'unavailable'],
        [{ status: 422 }, 'failed'],
        [new Error('network'), 'failed'],
    ])('%o -> %s', (error, problem) => {
        expect(classifyPreviewError(error)).toBe(problem)
    })
})

describe('EP-6 body and clip', () => {
    const v2: RecipePreviewInput = {
        voiceKey: VOICE_KEY,
        settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.1 },
        emotion: 'calm',
        textId: 'dialogue',
        language: 'es',
        tier: 'expressive',
        key: 'user-v2',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        urls = 0
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:preview-${++urls}`), revokeObjectURL: vi.fn() })
        getUserProfile.mockResolvedValue(profileWithPreviews(3))
        fetchProtectedMediaBlob.mockImplementation(async (url: string) => new Blob([url], { type: 'audio/mpeg' }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('sends exactly the six EP-6 keys', async () => {
        previewVoice.mockResolvedValue({ cache_key: 'v2a', previews_left: 2, tier_used: 'expressive', source: 'render' })
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(v2))

        const [body, options] = previewVoice.mock.calls[0] as [Record<string, unknown>, { signal: AbortSignal }]
        expect(body).toEqual({
            voice_key: VOICE_KEY,
            settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.1 },
            emotion: 'calm',
            text_id: 'dialogue',
            language: 'es',
            tier: 'expressive',
        })
        expect(Object.keys(body).sort()).toEqual(['emotion', 'language', 'settings', 'text_id', 'tier', 'voice_key'])
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(result.current.clip).toMatchObject({ key: 'user-v2', tierUsed: 'expressive', fallback: null, source: 'render' })
        expect(result.current.previewsLeft).toBe(2)
    })

    it('flags a Standard fallback when another tier rendered', async () => {
        previewVoice.mockResolvedValue({ cache_key: 'v2b', tier_used: 'standard' })
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(v2))
        expect(result.current.clip).toMatchObject({ tierUsed: 'standard', fallback: 'standard_fallback' })
    })

    it('keeps a catalog sample without the fixed-line transcript', async () => {
        // EP-6 answers a default recipe with the voice's own sample and `text: null`.
        previewVoice.mockResolvedValue({ cache_key: 'sha', url: '/voices/catalog/vk/sample.mp3', previews_left: 3, text: null, tier_used: 'expressive', source: 'sample' })
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(v2))
        expect(fetchProtectedMediaBlob).toHaveBeenCalledWith('/voices/catalog/vk/sample.mp3', 'audio/mpeg')
        expect(result.current.clip).toMatchObject({ text: null, source: 'sample' })
        expect(clipTranscript(result.current.clip!, 'Fixed line')).toBeNull()
        expect(clipTranscript({ text: null, source: 'render' }, 'Fixed line')).toBe('Fixed line')
        expect(clipTranscript({ text: 'Server text', source: null }, 'Fixed line')).toBe('Server text')
    })

    it('sends one request for a validation 422 and shows it as a failed preview', async () => {
        previewVoice.mockRejectedValue(httpError(422, undefined, { details: { validation: [{ type: 'missing', loc: ['body', 'tier'], msg: 'Field required' }] } }))
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(v2))
        expect(previewVoice).toHaveBeenCalledTimes(1)
        expect(result.current.problem).toBe('failed')
    })

    it('classifies refusals', async () => {
        const { result } = renderHook(() => useRecipePreview())
        previewVoice.mockRejectedValueOnce(httpError(402, 'insufficient_credits'))
        await act(() => result.current.run(v2))
        expect(result.current.problem).toBe('noCredits')
        previewVoice.mockRejectedValueOnce(httpError(429, 'daily_limit_reached', { details: { previews_left: 0 } }))
        await act(() => result.current.run(v2))
        expect(result.current.problem).toBe('limitReached')
        expect(result.current.previewsLeft).toBe(0)
        previewVoice.mockRejectedValueOnce(httpError(503, 'moderation_unavailable'))
        await act(() => result.current.run(v2))
        expect(result.current.problem).toBe('unavailable')
    })

    describe('credit state (AC-P5, 05 §6.3)', () => {
        const profile = (left: number, dailyLimit?: number, extra: Record<string, unknown> = {}) => ({
            membership: { previews_left: left, ...(dailyLimit === undefined ? {} : { limits: { voice_preview: { daily_limit: dailyLimit } } }), ...extra },
        })

        it('derives the free renders from the plan limit, and an answer corrects them', async () => {
            getUserProfile.mockResolvedValue(profile(8, 10))
            const { result } = renderHook(() => useRecipePreview())
            await waitFor(() => expect(result.current.previewsLeft).toBe(8))
            expect(result.current.freePreviewsLeft).toBe(1)
            expect(result.current.nextCostsCredit).toBe(false)

            previewVoice.mockResolvedValueOnce({ cache_key: 'a', previews_left: 7, free_previews_left: 0, source: 'render' })
            await act(() => result.current.run(v2))
            expect(result.current.freePreviewsLeft).toBe(0)
            expect(result.current.nextCostsCredit).toBe(true)

            // The server's count wins over the derivation (here it reports one more free render).
            previewVoice.mockResolvedValueOnce({ cache_key: 'b', previews_left: 6, free_previews_left: 1, source: 'render' })
            await act(() => result.current.run(v2))
            expect([result.current.previewsLeft, result.current.freePreviewsLeft, result.current.nextCostsCredit]).toEqual([6, 1, false])

            // An answer without the field (an older server) falls back to the derivation.
            previewVoice.mockResolvedValueOnce({ cache_key: 'c', previews_left: 5, source: 'render' })
            await act(() => result.current.run(v2))
            expect([result.current.freePreviewsLeft, result.current.nextCostsCredit]).toEqual([0, true])
        })

        it('a Free plan (hard limit = free allowance) never reaches the credit state', async () => {
            getUserProfile.mockResolvedValue(profile(1, 3))
            const { result } = renderHook(() => useRecipePreview())
            await waitFor(() => expect(result.current.freePreviewsLeft).toBe(1))
            expect(result.current.nextCostsCredit).toBe(false)
            previewVoice.mockRejectedValueOnce(httpError(429, 'daily_limit_reached', { details: { previews_left: 0 } }))
            await act(() => result.current.run(v2))
            expect([result.current.limitReached, result.current.nextCostsCredit]).toEqual([true, false])
        })

        it('without the plan limit the credit state stays unknown until an answer reports it', async () => {
            getUserProfile.mockResolvedValue(profile(2))
            const { result } = renderHook(() => useRecipePreview())
            await waitFor(() => expect(result.current.previewsLeft).toBe(2))
            expect([result.current.freePreviewsLeft, result.current.nextCostsCredit]).toEqual([null, false])
            previewVoice.mockResolvedValueOnce({ cache_key: 'a', previews_left: 1, source: 'render' })
            await act(() => result.current.run(input))
            expect([result.current.freePreviewsLeft, result.current.nextCostsCredit]).toEqual([null, false])
            previewVoice.mockResolvedValueOnce({ cache_key: 'b', previews_left: 1, free_previews_left: 0, source: 'render' })
            await act(() => result.current.run(input))
            expect([result.current.freePreviewsLeft, result.current.nextCostsCredit]).toEqual([0, true])
        })

        it('exposes the narration and call usage of the same profile read (AC-S3)', async () => {
            getUserProfile.mockResolvedValue(profile(4, 20, { narration_chars_used: 2_000, narration_chars_limit: 12_000, call_seconds_used: 300, call_seconds_limit: 1_800 }))
            const { result } = renderHook(() => useRecipePreview())
            await waitFor(() => expect(result.current.usage).not.toBeNull())
            expect(result.current.usage).toEqual({
                narration: { used: 2_000, limit: 12_000, remaining: 10_000 },
                call: { used: 300, limit: 1_800, remaining: 1_500 },
                previewsLeft: 4,
            })
            expect(getUserProfile).toHaveBeenCalledTimes(1)
        })

        it.each([
            [null, 5, null],
            [10, null, null],
            [3, 3, 3],
            [3, 0, 0],
            [10, 10, 3],
            [10, 8, 1],
            [10, 7, 0],
            [20, 12, 0],
        ])('deriveFreePreviewsLeft(%s, %s) = %s', (hard, left, free) => {
            expect(deriveFreePreviewsLeft(hard, left)).toBe(free)
        })
    })
})

describe('token-bucket 429 retry (05 §6.4)', () => {
    const v2: RecipePreviewInput = {
        voiceKey: VOICE_KEY,
        settings: null,
        emotion: 'calm',
        textId: 'narration',
        language: 'en',
        tier: 'standard',
        key: 'user-v2',
    }
    // The BFF's recipe-preview bucket: `rate_limited`, retryable, with `retry_after_seconds` and a Retry-After header.
    const bucket = (seconds: number | undefined) => httpError(429, 'rate_limited', { retryable: true, retryAfterSeconds: seconds })
    /** Lets the rejected request settle and the timers due within `ms` fire. */
    const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:retry'), revokeObjectURL: vi.fn() })
        getUserProfile.mockResolvedValue(profileWithPreviews(3))
        fetchProtectedMediaBlob.mockImplementation(async (url: string) => new Blob([url], { type: 'audio/mpeg' }))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('shows the rate-limit copy, waits the Retry-After, retries once and plays', async () => {
        previewVoice.mockRejectedValueOnce(bucket(2)).mockResolvedValueOnce({ cache_key: 'ok', previews_left: 2, tier_used: 'standard', source: 'render' })
        const { result } = renderHook(() => useRecipePreview())
        let running: Promise<void> = Promise.resolve()
        act(() => { running = result.current.run(v2) })
        await advance(0)

        expect(previewVoice).toHaveBeenCalledTimes(1)
        expect(result.current.loading).toBe(true)
        expect(result.current.problem).toBe('rateLimited')
        expect(result.current.error).toBe('Too many previews at once. Try again in a moment.')

        await advance(1_999)
        expect(previewVoice).toHaveBeenCalledTimes(1)
        await advance(1)
        await act(() => running)

        expect(previewVoice).toHaveBeenCalledTimes(2)
        expect(previewVoice.mock.calls[1][0]).toEqual(previewVoice.mock.calls[0][0])
        expect(result.current.status).toBe('ready')
        expect(result.current.problem).toBeNull()
        expect(result.current.clip).toMatchObject({ key: 'user-v2' })
        // A bucket refusal never touches the daily count.
        expect(result.current.previewsLeft).toBe(2)
    })

    it('retries only once: a second bucket 429 stays on the rate-limit copy', async () => {
        previewVoice.mockRejectedValue(bucket(1))
        const { result } = renderHook(() => useRecipePreview())
        await waitForCount(() => result.current.previewsLeft, 3)
        let running: Promise<void> = Promise.resolve()
        act(() => { running = result.current.run(v2) })
        await advance(0)
        await advance(1_000)
        await advance(60_000)
        await act(() => running)

        expect(previewVoice).toHaveBeenCalledTimes(2)
        expect(result.current.status).toBe('error')
        expect(result.current.problem).toBe('rateLimited')
        expect(result.current.previewsLeft).toBe(3)
    })

    it.each([
        ['the daily allowance', httpError(429, 'daily_limit_reached', { retryable: false, details: { previews_left: 0 } }), 'limitReached'],
        ['the in-flight cap', httpError(429, 'membership_in_flight_limit', { retryable: true, retryAfterSeconds: 1, details: { previews_left: 5 } }), 'rateLimited'],
        ['a bucket 429 without Retry-After', bucket(undefined), 'rateLimited'],
        ['a Retry-After past the cap', bucket(MAX_AUTO_RETRY_AFTER_SECONDS + 1), 'rateLimited'],
    ])('never retries %s', async (_label, error, problem) => {
        previewVoice.mockRejectedValue(error)
        const { result } = renderHook(() => useRecipePreview())
        await act(() => result.current.run(v2))
        await advance(120_000)
        expect(previewVoice).toHaveBeenCalledTimes(1)
        expect(result.current.problem).toBe(problem)
    })

    it('Stop during the wait cancels the retry', async () => {
        previewVoice.mockRejectedValueOnce(bucket(2))
        const { result } = renderHook(() => useRecipePreview())
        let running: Promise<void> = Promise.resolve()
        act(() => { running = result.current.run(v2) })
        await advance(0)
        expect(result.current.problem).toBe('rateLimited')
        act(() => result.current.stop())
        // Nothing is pending after Stop: the rate-limit copy goes with the wait.
        expect(result.current.problem).toBeNull()
        expect(result.current.error).toBeNull()
        await advance(5_000)
        await act(() => running)
        expect(previewVoice).toHaveBeenCalledTimes(1)
        expect(result.current.loading).toBe(false)
        expect(result.current.status).toBe('idle')
        expect(result.current.problem).toBeNull()
    })

    it('retries once per run, even when the attestation prompt re-runs the request (428 between bucket 429s)', async () => {
        previewVoice
            .mockRejectedValueOnce(bucket(1))
            .mockRejectedValueOnce(httpError(428, 'attestation_required'))
            .mockRejectedValueOnce(bucket(1))
            .mockResolvedValue({ cache_key: 'never', previews_left: 2, tier_used: 'standard', source: 'render' })
        const requestAttestation = vi.fn(async () => true)
        const withAttestation = vi.fn(async <T,>(operation: () => Promise<T>): Promise<T> => {
            try {
                return await operation()
            } catch (failure) {
                if ((failure as { status?: number }).status !== 428) throw failure
                if (!(await requestAttestation())) throw failure
                return operation()
            }
        })
        const value = { gate: 'unavailable', requestAttestation, withAttestation, expectSignupAttestation: vi.fn(), cancelSignupAttestation: vi.fn() } as unknown as AttestationContextValue
        const wrapper = ({ children }: { children: ReactNode }) => <AttestationContext.Provider value={value}>{children}</AttestationContext.Provider>
        const { result } = renderHook(() => useRecipePreview(), { wrapper })
        let running: Promise<void> = Promise.resolve()
        act(() => { running = result.current.run(v2) })
        await advance(0)
        await advance(1_000)
        await advance(60_000)
        await act(() => running)

        expect(requestAttestation).toHaveBeenCalledTimes(1)
        // 429 -> wait -> 428 -> accept -> 429: the bucket retry was spent, no second wait.
        expect(previewVoice).toHaveBeenCalledTimes(3)
        expect(result.current.status).toBe('error')
        expect(result.current.problem).toBe('rateLimited')
    })

    it.each([
        [bucket(2), 2_000],
        [bucket(0), 0],
        [bucket(0.5), 500],
        [httpError(429, 'RATE_LIMITED', { retryAfterSeconds: 3 }), 3_000],
        [bucket(MAX_AUTO_RETRY_AFTER_SECONDS), MAX_AUTO_RETRY_AFTER_SECONDS * 1_000],
        [bucket(MAX_AUTO_RETRY_AFTER_SECONDS + 1), null],
        [bucket(undefined), null],
        [bucket(-1), null],
        [httpError(429, 'rate_limited', { retryAfterSeconds: 2, details: { previews_left: 0 } }), null],
        [httpError(429, 'daily_limit_reached', { retryAfterSeconds: 2 }), null],
        [httpError(429, undefined, { retryAfterSeconds: 2 }), null],
        [httpError(503, 'rate_limited', { retryAfterSeconds: 2 }), null],
        [null, null],
    ])('tokenBucketRetryDelayMs(%o) = %s', (error, expected) => {
        expect(tokenBucketRetryDelayMs(error)).toBe(expected)
    })
})

/** Flushes until `read()` equals `value` (the profile read seeds the count). */
async function waitForCount(read: () => unknown, value: unknown) {
    for (let index = 0; index < 10 && read() !== value; index += 1) {
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    }
    expect(read()).toBe(value)
}
