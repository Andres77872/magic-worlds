import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import { readVoiceUsage } from '@/shared/voice/voiceUsage'
import { PreviewAllowanceContext, type PreviewAllowance } from './previewAllowanceContext'

export const FREE_PREVIEWS_PER_DAY = 3
export const PREVIEW_ALLOWANCE_CHANNEL = 'magic_worlds:voice_preview_allowance'

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}

export function deriveFreePreviewsLeft(hardLimit: number | null, previewsLeft: number | null): number | null {
    if (hardLimit === null || previewsLeft === null) return null
    return Math.max(0, Math.min(previewsLeft, FREE_PREVIEWS_PER_DAY - Math.max(0, hardLimit - previewsLeft)))
}

/** Account allowance only: each player keeps its own clip and abort controller. */
export function useLocalPreviewAllowance(userHash: string | null, owned = true): PreviewAllowance {
    const [state, setState] = useState<Pick<PreviewAllowance, 'previewsLeft' | 'freePreviewsLeft' | 'usage'>>({ previewsLeft: null, freePreviewsLeft: null, usage: null })
    const hardLimit = useRef<number | null>(null)
    const revision = useRef(0)
    const requests = useRef(0)
    const lastAnswer = useRef(0)
    const live = useRef(true)
    const pending = useRef<{ revision: number; promise: Promise<void> } | null>(null)
    const channel = useRef<BroadcastChannel | null>(null)

    const refreshAllowance = useCallback((): Promise<void> => {
        if (pending.current?.revision === revision.current) return pending.current.promise
        const mine = ++revision.current
        // Defer the ownership check too: StrictMode reconnects child effects
        // before the provider's effect, while actual unmounts stay inactive.
        const promise = Promise.resolve().then(() => live.current && mine === revision.current ? apiService.getUserProfile() : undefined).then(profile => {
            if (!live.current || mine !== revision.current) return
            const usage = readVoiceUsage(profile?.membership)
            hardLimit.current = count(profile?.membership?.limits?.voice_preview?.daily_limit) ?? hardLimit.current
            if (usage) setState(current => ({
                usage,
                previewsLeft: usage.previewsLeft ?? current.previewsLeft,
                freePreviewsLeft: usage.previewsLeft === null ? current.freePreviewsLeft : deriveFreePreviewsLeft(hardLimit.current, usage.previewsLeft),
            }))
        }).catch(() => {
            // An unknown allowance never grants permission to spend; the server cap does.
        }).finally(() => {
            if (pending.current?.revision === mine) pending.current = null
        })
        pending.current = { revision: mine, promise }
        return promise
    }, [])

    const notify = useCallback(() => {
        if (!userHash) return
        try {
            if (channel.current) channel.current.postMessage({ userHash })
            else window.localStorage.setItem(PREVIEW_ALLOWANCE_CHANNEL, JSON.stringify({ userHash, nonce: `${Date.now()}:${Math.random()}` }))
        } catch { /* Storage/channel availability must not control billing. */ }
    }, [userHash])

    const invalidateLocal = useCallback(() => {
        revision.current += 1
        if (live.current) {
            setState(current => ({ ...current, previewsLeft: null, freePreviewsLeft: null,
                usage: current.usage ? { ...current.usage, previewsLeft: null } : null }))
            void refreshAllowance()
        }
    }, [refreshAllowance])

    const invalidate = useCallback(() => {
        notify()
        invalidateLocal()
    }, [notify, invalidateLocal])

    const beginRequest = useCallback(() => {
        revision.current += 1 // A profile read started before this request cannot overwrite its answer.
        notify()
        return ++requests.current
    }, [notify])

    const setAllowance = useCallback((left: number | null, free: number | null = null, request?: number) => {
        if (!live.current || (request !== undefined && request < lastAnswer.current)) return
        if (request !== undefined) lastAnswer.current = request
        revision.current += 1
        setState(current => ({ ...current, previewsLeft: left,
            usage: current.usage ? { ...current.usage, previewsLeft: left } : null,
            freePreviewsLeft: free !== null && left !== null ? Math.min(free, left) : deriveFreePreviewsLeft(hardLimit.current, left) }))
        notify()
    }, [notify])

    useEffect(() => {
        live.current = true
        return () => { live.current = false; revision.current += 1 }
    }, [])

    useEffect(() => {
        if (!owned || !userHash) return
        const receive = (data: unknown) => {
            if (data && typeof data === 'object' && (data as { userHash?: unknown }).userHash === userHash) invalidateLocal()
        }
        let next: BroadcastChannel | null = null
        try {
            if (typeof BroadcastChannel !== 'undefined') next = new BroadcastChannel(PREVIEW_ALLOWANCE_CHANNEL)
        } catch { /* Fall back to account-scoped storage invalidation. */ }
        if (next) {
            channel.current = next
            next.onmessage = event => receive(event.data)
            return () => { channel.current = null; next.close() }
        }
        const storage = (event: StorageEvent) => {
            if (event.key !== PREVIEW_ALLOWANCE_CHANNEL || !event.newValue) return
            try { receive(JSON.parse(event.newValue)) } catch { /* Ignore malformed external data. */ }
        }
        window.addEventListener('storage', storage)
        return () => window.removeEventListener('storage', storage)
    }, [owned, userHash, invalidateLocal])

    return { ...state, userHash, beginRequest, setAllowance, refreshAllowance, invalidate }
}

export function usePreviewAllowance(enabled: boolean, userHash: string | null): PreviewAllowance {
    const shared = useContext(PreviewAllowanceContext)
    // Standalone previews (including isolated component stories) remain usable.
    const local = useLocalPreviewAllowance(userHash, !shared)
    const allowance = shared ?? local
    const refresh = allowance.refreshAllowance
    useEffect(() => {
        if (!enabled) return
        void refresh()
        const focused = () => { void refresh() }
        const visible = () => { if (document.visibilityState === 'visible') void refresh() }
        window.addEventListener('focus', focused)
        document.addEventListener('visibilitychange', visible)
        return () => {
            window.removeEventListener('focus', focused)
            document.removeEventListener('visibilitychange', visible)
        }
    }, [enabled, refresh])
    return allowance
}
