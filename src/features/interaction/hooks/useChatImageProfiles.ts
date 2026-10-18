/**
 * The image profiles a chat's scene images can run on, loaded once per API
 * (workspace) while images are available: the pickable fal profiles and the
 * one a turn uses when none is chosen. A `503` means image generation is off
 * on this server; the composer then hides its image model choice.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ImageProfile, ImageProfileList } from '@/shared'
import type { ApiService } from '@/infrastructure/api'
import { ApiError } from '@/infrastructure/api'
import { chatDefaultProfileId, chatPickableProfiles } from '@/features/imageProfiles/imageProfileModel'

type LoadResult =
    | { phase: 'loaded'; list: ImageProfileList }
    | { phase: 'failed' | 'unavailable' }

export interface ChatImageProfiles {
    profiles: ImageProfile[]
    /** The list has been read (the profiles above are the server's). */
    loaded: boolean
    /** The profile a turn runs on when none is chosen; null when no chat profile qualifies. */
    defaultId: string | null
    loading: boolean
    failed: boolean
    /** The server has image generation turned off. */
    unavailable: boolean
    reload: () => void
}

const NO_PROFILES: ImageProfile[] = []

export function useChatImageProfiles(api: Pick<ApiService, 'getImageProfiles'>, active: boolean): ChatImageProfiles {
    // The answer is kept with the request it answers, so a reload or another workspace reads as loading.
    const [settled, setSettled] = useState<{ api: Pick<ApiService, 'getImageProfiles'>; attempt: number; result: LoadResult } | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        if (!active) return
        let current = true
        api.getImageProfiles().then(
            list => { if (current) setSettled({ api, attempt, result: { phase: 'loaded', list } }) },
            (error: unknown) => {
                if (current) setSettled({ api, attempt, result: { phase: error instanceof ApiError && error.status === 503 ? 'unavailable' : 'failed' } })
            },
        )
        return () => { current = false }
    }, [api, active, attempt])

    const reload = useCallback(() => setAttempt(value => value + 1), [])
    const result = settled && settled.api === api && settled.attempt === attempt ? settled.result : null
    const list = result?.phase === 'loaded' ? result.list : null
    const profiles = useMemo(() => (list ? chatPickableProfiles(list.items) : NO_PROFILES), [list])

    return {
        profiles,
        loaded: list !== null,
        defaultId: chatDefaultProfileId(list),
        loading: active && result === null,
        failed: result?.phase === 'failed',
        unavailable: result?.phase === 'unavailable',
        reload,
    }
}
