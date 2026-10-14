import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { isAbortError } from '../consoleErrors'

export interface AbortableLoad<T> {
    data: T | null
    loading: boolean
    error: unknown
    reload: () => void
    /** Local patch after a mutation, without a refetch. */
    setData: (update: (previous: T | null) => T | null) => void
}

/**
 * Console loader (05 §8.14, D30): every run gets its own AbortController, the
 * previous run is aborted, and a late response from an aborted run is ignored,
 * so a slow refresh can never overwrite a newer one. `key` names the inputs:
 * when it changes, the loader runs again.
 */
export function useAbortableLoad<T>(load: (signal: AbortSignal) => Promise<T>, key = '', enabled = true): AbortableLoad<T> {
    const [nonce, setNonce] = useState(0)
    const request = `${nonce}:${key}`
    // `settled` names the request the data or error belong to; until the current
    // request settles the loader is loading (and keeps showing the last data).
    const [state, setState] = useState<{ data: T | null; error: unknown; settled: string | null }>({ data: null, error: null, settled: null })
    const run = useEffectEvent((signal: AbortSignal) => load(signal))

    useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        run(controller.signal).then(
            (data) => {
                if (!controller.signal.aborted) setState({ data, error: null, settled: request })
            },
            (error: unknown) => {
                if (controller.signal.aborted || isAbortError(error)) return
                setState((previous) => ({ ...previous, error, settled: request }))
            },
        )
        return () => controller.abort()
    }, [request, enabled])

    const reload = useCallback(() => setNonce((value) => value + 1), [])
    const setData = useCallback((update: (previous: T | null) => T | null) => {
        setState((previous) => ({ ...previous, data: update(previous.data) }))
    }, [])

    const current = state.settled === request
    return { data: state.data, loading: enabled && !current, error: current ? state.error : null, reload, setData }
}
