/**
 * The account-level voice read (09 §2): `GET /voices/capabilities` (I-32),
 * through the shared 60 s cache.
 *
 * Every signed-in caller is on the ElevenLabs engine, so nothing branches on a
 * route: the hook only says what the account may do. A failed read (404
 * included) gives `capabilities = null` with its `error`; the V2 surfaces then
 * show their read-only recipe and a retry. An api without
 * `getVoiceCapabilities` (test mocks) or a disabled read settles at once, with
 * `loading` false on the first render. A warm cache (`peekVoiceCapabilities`)
 * also settles on the first render; the read still runs and replaces it.
 * Disabling the read (a closed picker, a sign-out) forgets its answer, so the
 * next enable never shows another session's capabilities: it starts over from
 * the per-account warm cache, else loading.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiService, type ApiService } from '@/infrastructure/api'
import type { VoiceCapabilities } from '@/shared'

export interface VoiceCapabilitiesState {
    capabilities: VoiceCapabilities | null
    loading: boolean
    error: unknown
    /** Read again, skipping the cache. */
    retry: () => void
}

export type VoiceCapabilitiesReader = Partial<Pick<ApiService, 'getVoiceCapabilities' | 'peekVoiceCapabilities'>> | null | undefined

export interface UseVoiceCapabilitiesOptions {
    /** Read only while true (default true). */
    enabled?: boolean
    /** The api to read through (default `apiService`). */
    api?: VoiceCapabilitiesReader
}

interface ReadState {
    capabilities: VoiceCapabilities | null
    error: unknown
    settled: boolean
}

const UNREAD: ReadState = { capabilities: null, error: null, settled: false }

function canRead(api: VoiceCapabilitiesReader): api is Pick<ApiService, 'getVoiceCapabilities'> {
    return typeof api?.getVoiceCapabilities === 'function'
}

/** The warm-cache value, when the api can answer synchronously; never throws. */
function peek(api: VoiceCapabilitiesReader): VoiceCapabilities | null {
    if (typeof api?.peekVoiceCapabilities !== 'function') return null
    try {
        return api.peekVoiceCapabilities() ?? null
    } catch {
        return null
    }
}

export function useVoiceCapabilities(options: UseVoiceCapabilitiesOptions = {}): VoiceCapabilitiesState {
    const enabled = options.enabled ?? true
    const api: VoiceCapabilitiesReader = options.api === undefined ? apiService : options.api
    const readable = enabled && canRead(api)
    const [state, setState] = useState<ReadState>(UNREAD)
    const [attempt, setAttempt] = useState(0)
    // Reset while rendering the disable, never by a late effect that could drop a fresh answer.
    const [wasReadable, setWasReadable] = useState(readable)
    if (wasReadable !== readable) {
        setWasReadable(readable)
        if (!readable) {
            setState(UNREAD)
            setAttempt(0)
        }
    }

    useEffect(() => {
        if (!readable) return
        let cancelled = false
        const fresh = attempt > 0
        void Promise.resolve()
            .then(() => api.getVoiceCapabilities(fresh ? { fresh: true } : {}))
            .then((capabilities) => {
                if (!cancelled) setState({ capabilities: capabilities ?? null, error: null, settled: true })
            })
            .catch((error: unknown) => {
                if (!cancelled) setState({ capabilities: null, error, settled: true })
            })
        return () => {
            cancelled = true
        }
    }, [api, readable, attempt])

    const retry = useCallback(() => {
        setState((current) => ({ ...current, settled: false }))
        setAttempt((value) => value + 1)
    }, [])

    if (!readable) return { capabilities: null, loading: false, error: null, retry }
    // First read since the read was enabled and the cache is warm: answer now (a retry always waits for its fresh read).
    const warm = !state.settled && attempt === 0 ? peek(api) : null
    if (warm) return { capabilities: warm, loading: false, error: null, retry }
    return { capabilities: state.capabilities, loading: !state.settled, error: state.error, retry }
}
