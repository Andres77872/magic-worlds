/**
 * A chat's own voice projections (see `sessionVoiceCache`), or null while
 * disabled, loading or after a failed read (a 404 included, which reads as
 * "nothing to show"). A refetch after an invalidation keeps
 * the last answer on screen until the new one lands.
 *
 * `revision` is the chat record the caller shows (DataProvider's object): when
 * it changes, as after any D36 refresh, the chat is read again.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ApiService } from '@/infrastructure/api'
import {
    loadSessionVoices,
    noteSessionRevision,
    sessionVoicesKey,
    sessionVoicesVersion,
    subscribeSessionVoices,
    type SessionVoices,
} from './sessionVoiceCache'

export function useSessionVoices(
    api: ApiService | null,
    workspaceId: string | null,
    sessionId: number | null,
    revision?: unknown,
): { key: string | null; voices: SessionVoices | null } {
    const version = useSyncExternalStore(subscribeSessionVoices, sessionVoicesVersion, sessionVoicesVersion)
    const key = api && workspaceId && sessionId !== null ? sessionVoicesKey(workspaceId, sessionId) : null
    const [state, setState] = useState<{ key: string; voices: SessionVoices | null } | null>(null)

    useEffect(() => {
        if (!key || !api || sessionId === null) return
        noteSessionRevision(key, revision)
        let cancelled = false
        loadSessionVoices(api, key, sessionId)
            .then((voices) => {
                if (!cancelled) setState({ key, voices })
            })
            .catch(() => {
                if (!cancelled) setState({ key, voices: null })
            })
        return () => {
            cancelled = true
        }
    }, [api, key, sessionId, version, revision])

    return { key, voices: key && state?.key === key ? state.voices : null }
}
