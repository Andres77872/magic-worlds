/**
 * "Hear my recipe" (D18, 05 §6, 09 §4.4, EP-6): a metered render of one fixed
 * `text_id` with a catalog voice, its V2 settings and a narration tier.
 *
 * - One request at a time, latest wins: a new run aborts the previous request,
 *   and a sequence number drops any late response, so a slow preview never
 *   replaces a newer one (the D30 preview race).
 * - `previewsLeft` is seeded from the membership usage (`GET /user/me`, D24)
 *   and corrected by every response; a daily-limit 429 sets it to 0.
 * - 428 `attestation_required` opens the attestation prompt and retries once
 *   (`useAttestation().withAttestation`).
 * - The audio is fetched as an authed blob (`/voice-presets/preview/…`) and
 *   played from an object URL, revoked when replaced or on unmount.
 * - Thought previews play at ×0.708 (D16), times the voice's `gain_db` when the
 *   server sends one.
 * - The body is exactly `{voice_key, settings, emotion, text_id, language, tier}`
 *   (EP-6). When the server renders another tier than the one asked for
 *   (`tier_used`), the clip carries `fallback: 'standard_fallback'`.
 * - The credit state (AC-P5, 05 §6.3): `freePreviewsLeft` is the free renders
 *   left today. An answer's `free_previews_left` sets it; otherwise it is
 *   derived from the plan's `voice_preview` hard limit (`membership.limits`)
 *   and D18's 3 free renders a day. `nextCostsCredit` says the next render
 *   (a cache miss) costs 1 credit: previews left, none of them free.
 * - `usage` is the same profile read's D24 usage (narration, calls), for the
 *   Studio usage strip (AC-S3); no extra request.
 * - 05 §6.4: a token-bucket 429 (`rate_limited` with a Retry-After) shows the
 *   rate-limit copy and retries once after that wait (`tokenBucketRetryDelayMs`).
 *   The daily allowance and the in-flight cap are never retried.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { apiService } from '@/infrastructure/api'
import { useAttestation } from '@/features/legal/attestation/attestationContext'
import type {
    NarrationTier,
    VoiceProvider,
    PreviewTextId,
    VoiceEmotion,
    VoicePresetPreviewRequestV2,
    VoicePresetPreviewResponse,
    VoiceSettingsV2,
    VoicePerformance,
    UtterancePerformance,
} from '@/shared'
import { clipVolume } from '@/shared/voice/clipVolume'
import { readVoiceUsage, type VoiceUsageView } from '@/shared/voice/voiceUsage'

/** The recipe preview (EP-6): a catalog voice, its V2 settings and a narration tier. */
export interface RecipePreviewInput {
    performance?: VoicePerformance | UtterancePerformance | null
    authoredText?: string
    provider?: VoiceProvider
    voiceKey: string
    settings: VoiceSettingsV2 | null
    emotion: VoiceEmotion | null
    textId: PreviewTextId
    /** The language of the chosen text set. */
    language: string
    tier: NarrationTier
    /** What the clip belongs to (a preset row), so a list shows it only under that row. */
    key?: string | null
}

export interface RecipePreviewClip {
    /** Object URL of the rendered audio. */
    src: string
    /** The input's `key`, or null. */
    key: string | null
    textId: PreviewTextId
    /** The language of the rendered text. */
    language: string
    /** The rendered text when the server sends it; otherwise the chooser's text. */
    text: string | null
    /** Element volume, 0..1 (thought factor and `gain_db`, D16). */
    volume: number
    cached: boolean
    /** The tier that rendered, when the server reports it. */
    tierUsed?: NarrationTier | null
    /** The server rendered a lower tier than requested (badge `standard_fallback`). */
    fallback?: 'standard_fallback' | null
    /** A fresh render or the voice's catalog sample (no fixed-text transcript). */
    source?: 'render' | 'sample' | null
}

/** Why the last preview did not play. `limitReached` shows in the allowance helper, not as an error. */
export type RecipePreviewProblem = 'limitReached' | 'rateLimited' | 'noCredits' | 'voiceUnavailable' | 'unavailable' | 'attestation' | 'failed'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface PreviewState {
    status: Status
    clip: RecipePreviewClip | null
    problem: RecipePreviewProblem | null
}

const IDLE: PreviewState = { status: 'idle', clip: null, problem: null }

/** 429 codes for the daily preview limit (D18). */
const DAILY_LIMIT_CODES: ReadonlySet<string> = new Set(['daily_limit_reached', 'preview_limit_reached', 'preview_limit_hit', 'daily_limit'])

/** Token-bucket 429s (D37) keep the daily count. */
const RATE_LIMIT_CODES: ReadonlySet<string> = new Set(['rate_limited', 'rate_limit_exceeded', 'too_many_requests'])

interface ErrorLike {
    status?: unknown
    code?: unknown
    category?: unknown
    name?: unknown
    retryAfterSeconds?: unknown
    details?: unknown
}

function isAbort(error: unknown): boolean {
    return (error as ErrorLike | null)?.name === 'AbortError'
}

/** The `previews_left` an error body carries (`detail.previews_left`), or null. */
export function previewsLeftOf(error: unknown): number | null {
    const details = (error as ErrorLike | null)?.details
    return details && typeof details === 'object' ? count((details as { previews_left?: unknown }).previews_left) : null
}

/**
 * Why a preview failed. A 429 is the daily limit when its code or
 * `previews_left: 0` says so, or when nothing marks it as the token bucket (a
 * code, `retry_after`, or previews still left).
 */
export function classifyPreviewError(error: unknown): RecipePreviewProblem {
    const failure = (error ?? {}) as ErrorLike
    const status = typeof failure.status === 'number' ? failure.status : 0
    const code = typeof failure.code === 'string' ? failure.code.toLowerCase() : ''
    if (status === 428 || code === 'attestation_required') return 'attestation'
    if (status === 429) {
        const left = previewsLeftOf(error)
        if (DAILY_LIMIT_CODES.has(code) || left === 0) return 'limitReached'
        const bucket = RATE_LIMIT_CODES.has(code) || failure.category === 'rate_limited' || typeof failure.retryAfterSeconds === 'number'
        return bucket || left !== null ? 'rateLimited' : 'limitReached'
    }
    if (status === 402 || code === 'insufficient_credits') return 'noCredits'
    if (code === 'voice_unavailable') return 'voiceUnavailable'
    if (status === 503 || code === 'moderation_unavailable') return 'unavailable'
    return 'failed'
}

/**
 * The longest Retry-After a token-bucket 429 is retried after on its own (05 §6.4).
 * The recipe-preview bucket (6/min) never asks for more than 10 s; a longer wait
 * is shown as the rate-limit copy only, so a spinner never hangs on a bad header.
 */
export const MAX_AUTO_RETRY_AFTER_SECONDS = 30

/**
 * The wait in ms before the one automatic retry of a preview 429 (05 §6.4),
 * or null when it is not retried. The BFF tells its 429s apart by code: the
 * recipe-preview token bucket (and the reservation race) answer `rate_limited`
 * with `retry_after_seconds` and a `Retry-After` header; the daily allowance
 * answers `daily_limit_reached` with `previews_left: 0`, and the in-flight cap
 * `membership_in_flight_limit`. Only the first is retried, and only when it
 * says how long to wait.
 */
export function tokenBucketRetryDelayMs(error: unknown): number | null {
    const failure = (error ?? {}) as ErrorLike
    if (failure.status !== 429) return null
    const code = typeof failure.code === 'string' ? failure.code.toLowerCase() : ''
    if (!RATE_LIMIT_CODES.has(code) || previewsLeftOf(error) === 0) return null
    const seconds = failure.retryAfterSeconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_AUTO_RETRY_AFTER_SECONDS) return null
    return Math.ceil(seconds * 1000)
}

/** Resolves after `ms`, or rejects with an `AbortError` when the signal aborts first. */
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const aborted = () => Object.assign(new Error('The preview was stopped.'), { name: 'AbortError' })
        if (signal.aborted) {
            reject(aborted())
            return
        }
        const onAbort = () => {
            clearTimeout(timer)
            reject(aborted())
        }
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        signal.addEventListener('abort', onAbort, { once: true })
    })
}

const PROBLEM_KEYS: Record<Exclude<RecipePreviewProblem, 'limitReached'>, string> = {
    rateLimited: 'voices.preview.rateLimited',
    noCredits: 'voices.preview.noCredits',
    voiceUnavailable: 'voices.preview.voiceUnavailable',
    unavailable: 'voices.preview.unavailable',
    attestation: 'attestation.required',
    failed: 'voices.preview.error',
}

/** Inline error copy; the daily limit has none (the allowance helper says it). */
export function previewProblemMessage(problem: RecipePreviewProblem | null, t: TFunction): string | null {
    if (!problem || problem === 'limitReached') return null
    return t(PROBLEM_KEYS[problem])
}

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}

/** D18 / I-3: the first 3 recipe renders a day are free on every plan (the BFF's `FREE_PREVIEWS_PER_DAY`). */
export const FREE_PREVIEWS_PER_DAY = 3

/**
 * Free renders left today from the plan's hard limit and `previews_left`
 * (renders today = limit − left), never above `previews_left`; null when
 * either is unknown. An answer's own `free_previews_left` wins over this.
 */
export function deriveFreePreviewsLeft(hardLimit: number | null, previewsLeft: number | null): number | null {
    if (hardLimit === null || previewsLeft === null) return null
    const used = Math.max(0, hardLimit - previewsLeft)
    return Math.max(0, Math.min(previewsLeft, FREE_PREVIEWS_PER_DAY - used))
}

/** The plan's `voice_preview` daily hard limit from a profile membership, or null. */
function previewHardLimit(membership: unknown): number | null {
    const limits = (membership as { limits?: Record<string, { daily_limit?: unknown } | undefined> } | null | undefined)?.limits
    return count(limits?.voice_preview?.daily_limit)
}

/**
 * The transcript under a played clip: the server's text, else the chooser's fixed
 * text. A catalog sample (EP-6 `source: 'sample'`) is the voice's own recording,
 * not the fixed line, so it has none (null).
 */
export function clipTranscript(clip: Pick<RecipePreviewClip, 'text' | 'source'>, fixedText: string): string | null {
    if (clip.source === 'sample') return null
    return clip.text ?? fixedText
}

/** The response's audio path: its `url`, else the documented `/voice-presets/preview/{cache_key}.mp3`. */
export function previewAudioUrl(response: VoicePresetPreviewResponse | null | undefined): string | null {
    if (!response) return null
    if (typeof response.url === 'string' && response.url.trim()) return response.url
    if (typeof response.cache_key === 'string' && response.cache_key.trim()) {
        return `/voice-presets/preview/${encodeURIComponent(response.cache_key)}.mp3`
    }
    return null
}

/** EP-6: exactly these six keys (the BFF model is extra=forbid). */
export function previewRequestBody(input: RecipePreviewInput): VoicePresetPreviewRequestV2 {
    return {
        voice_key: input.voiceKey,
        ...(input.provider === 'fish_audio' ? { schema_version: 3 as const, provider: 'fish_audio' as const } : {}),
        ...(input.provider === 'fish_audio' && input.performance ? { performance: input.performance } : {}),
        settings: input.settings ?? null,
        emotion: input.emotion ?? null,
        text_id: input.textId,
        language: input.language,
        tier: input.tier,
    }
}

export interface UseRecipePreviewOptions {
    /** Seeds the allowance while true (an open drawer, a signed-in page). */
    enabled?: boolean
}

export function useRecipePreview({ enabled = true }: UseRecipePreviewOptions = {}) {
    const { t } = useTranslation()
    const attestation = useAttestation()
    const attestationRef = useRef(attestation)
    const [state, setState] = useState<PreviewState>(IDLE)
    const [previewsLeft, setPreviewsLeft] = useState<number | null>(null)
    const [freePreviewsLeft, setFreePreviewsLeft] = useState<number | null>(null)
    const [usage, setUsage] = useState<VoiceUsageView | null>(null)
    // The plan's `voice_preview` hard limit, from the last profile read (derives the free count).
    const hardLimit = useRef<number | null>(null)
    const seq = useRef(0)
    const controller = useRef<AbortController | null>(null)
    const objectUrl = useRef<string | null>(null)
    // Bumped by every allowance write, so a slow profile read never overwrites a newer response.
    const allowanceSeq = useRef(0)

    useEffect(() => {
        attestationRef.current = attestation
    }, [attestation])

    /** `free`: the server's own free count, when it sends one; otherwise derived from the hard limit. */
    const setAllowance = useCallback((left: number | null, free: number | null = null) => {
        allowanceSeq.current += 1
        setPreviewsLeft(left)
        setFreePreviewsLeft(free !== null && left !== null ? Math.min(free, left) : deriveFreePreviewsLeft(hardLimit.current, left))
    }, [])

    const refreshAllowance = useCallback(() => {
        const mine = ++allowanceSeq.current
        void Promise.resolve()
            .then(() => apiService.getUserProfile())
            .then((profile) => {
                const read = readVoiceUsage(profile?.membership)
                const left = read?.previewsLeft ?? null
                hardLimit.current = previewHardLimit(profile?.membership) ?? hardLimit.current
                if (read) setUsage(read)
                if (mine === allowanceSeq.current && left !== null) {
                    setPreviewsLeft(left)
                    setFreePreviewsLeft(deriveFreePreviewsLeft(hardLimit.current, left))
                }
            })
            .catch(() => {
                // The count is a hint: keep the last value.
            })
    }, [])

    useEffect(() => {
        if (enabled) refreshAllowance()
    }, [enabled, refreshAllowance])

    const replaceObjectUrl = useCallback((next: string | null) => {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = next
    }, [])

    useEffect(() => () => {
        seq.current += 1
        controller.current?.abort()
        controller.current = null
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = null
    }, [])

    const run = useCallback(async (input: RecipePreviewInput) => {
        controller.current?.abort()
        const abort = new AbortController()
        controller.current = abort
        const mine = ++seq.current
        setState((current) => ({ ...current, status: 'loading', problem: null }))

        const once = () => input.authoredText !== undefined
            ? apiService.previewVoicePerformance({ voice_key: input.voiceKey, text: input.authoredText,
                language: input.language as 'en' | 'es', kind: input.textId, emotion: input.emotion,
                performance: input.performance as UtterancePerformance }, abort.signal)
            : apiService.previewVoice(previewRequestBody(input), { signal: abort.signal })
        // 05 §6.4: a token-bucket 429 shows its copy, waits its Retry-After and retries once.
        let bucketRetried = false
        const request = async () => {
            try {
                return await once()
            } catch (error) {
                const delay = bucketRetried ? null : tokenBucketRetryDelayMs(error)
                if (delay === null || mine !== seq.current) throw error
                bucketRetried = true
                setState((current) => ({ ...current, status: 'loading', problem: 'rateLimited' }))
                await abortableDelay(delay, abort.signal)
                setState((current) => ({ ...current, problem: null }))
                return once()
            }
        }
        try {
            const gate = attestationRef.current
            const response = await (gate ? gate.withAttestation(request) : request())
            if (mine !== seq.current) return
            const left = count(response?.previews_left)
            if (left !== null) setAllowance(left, count(response?.free_previews_left))
            const url = previewAudioUrl(response)
            if (!url) throw new Error('The preview response has no audio.')
            const blob = await apiService.fetchProtectedMediaBlob(url, 'audio/mpeg')
            if (mine !== seq.current) return
            const text = typeof response.text === 'string' && response.text.trim() ? response.text : null
            const gainDb = response.gain_db ?? 0
            const tierUsed = response.tier_used === 'standard' || response.tier_used === 'expressive' ? response.tier_used : null
            const src = URL.createObjectURL(blob)
            replaceObjectUrl(src)
            setState({
                status: 'ready',
                problem: null,
                clip: {
                    src,
                    key: input.key ?? null,
                    textId: input.textId,
                    language: input.language,
                    text,
                    volume: clipVolume(1, gainDb, input.textId),
                    cached: response.cached === true,
                    tierUsed,
                    fallback: tierUsed !== null && tierUsed !== input.tier ? 'standard_fallback' : null,
                    source: response.source === 'sample' || response.source === 'render' ? response.source : null,
                },
            })
        } catch (error) {
            if (mine !== seq.current || isAbort(error)) return
            const problem = classifyPreviewError(error)
            const left = previewsLeftOf(error)
            if (left !== null) {
                setAllowance(left)
            } else if (problem === 'limitReached') {
                setAllowance(0)
                // The server's own count wins when the profile reports one.
                refreshAllowance()
            }
            setState((current) => ({ ...current, status: 'error', problem }))
        } finally {
            if (controller.current === abort) controller.current = null
        }
    }, [replaceObjectUrl, setAllowance, refreshAllowance])

    /**
     * Abort the client wait (the server may still finish and cache the render); keep the last clip.
     * A stopped load drops its problem: the token-bucket wait's copy has nothing pending after it.
     */
    const stop = useCallback(() => {
        seq.current += 1
        controller.current?.abort()
        controller.current = null
        setState((current) => (current.status === 'loading' ? { ...current, status: current.clip ? 'ready' : 'idle', problem: null } : current))
    }, [])

    /** Stop and forget the clip (another text chosen, the drawer closed). */
    const reset = useCallback(() => {
        seq.current += 1
        controller.current?.abort()
        controller.current = null
        replaceObjectUrl(null)
        setState((current) => (current === IDLE ? current : IDLE))
    }, [replaceObjectUrl])

    return {
        status: state.status,
        loading: state.status === 'loading',
        clip: state.clip,
        problem: state.problem,
        error: previewProblemMessage(state.problem, t),
        previewsLeft,
        /** Free renders left today (AC-P5); null when unknown. */
        freePreviewsLeft,
        /** The next render (a cache miss) costs 1 credit: previews left, none free (05 §6.3). */
        nextCostsCredit: previewsLeft !== null && previewsLeft > 0 && freePreviewsLeft === 0,
        /** Today's narration and call usage from the same profile read (AC-S3), or null. */
        usage,
        limitReached: previewsLeft === 0,
        run,
        stop,
        reset,
        refreshAllowance,
    }
}

export type RecipePreview = ReturnType<typeof useRecipePreview>
