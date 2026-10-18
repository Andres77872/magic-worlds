import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, workspaceStorageKey } from '@/shared/workspaceStorage'
import { isManuscriptPosition, type ManuscriptPosition } from '../editor/manuscript'

function read(key: string | null): { position: ManuscriptPosition | null; unavailable: boolean } {
    if (!key) return { position: null, unavailable: false }
    try {
        const raw = localStorage.getItem(key)
        const value: unknown = raw && raw.length <= 2048 ? JSON.parse(raw) : null
        return { position: isManuscriptPosition(value) ? value : null, unavailable: false }
    } catch { return { position: null, unavailable: true } }
}

export function useScenePosition(storyId: string | null, sceneId: string | null, workspaceId: string | null) {
    const { userHash } = useAuth()
    const key = userHash && workspaceId && storyId && sceneId ? workspaceStorageKey(`magic-worlds:novel-position:v1:${storyId}:${sceneId}`, { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash, workspaceId }) : null
    const seed = useMemo(() => read(key), [key])
    const pending = useRef(new Map<string, ManuscriptPosition>())
    const latest = useRef(new Map<string, ManuscriptPosition>())
    const current = useRef<string | null | undefined>(key)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [status, setStatus] = useState<ReadonlyMap<string, boolean>>(() => new Map())
    useLayoutEffect(() => { current.current = key; return () => { current.current = undefined } }, [key])

    const flush = useCallback(() => {
        for (const [target, position] of pending.current) {
            let unavailable = false
            try { localStorage.setItem(target, JSON.stringify(position)); pending.current.delete(target) }
            catch { unavailable = true }
            if (current.current !== undefined) setStatus((previous) => {
                if (previous.get(target) === unavailable) return previous
                const next = new Map(previous); next.set(target, unavailable); return next
            })
        }
    }, [])
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); flush() }, [flush, key])
    useEffect(() => {
        const visibility = () => { if (document.visibilityState === 'hidden') flush() }
        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', visibility)
        return () => {
            window.removeEventListener('pagehide', flush)
            document.removeEventListener('visibilitychange', visibility)
        }
    }, [flush])

    const onPositionChange = useCallback((position: ManuscriptPosition) => {
        if (!key || current.current !== key || !isManuscriptPosition(position)) return
        const captured = { anchor: { ...position.anchor }, head: { ...position.head }, scrollTop: position.scrollTop, ...(position.documentFingerprint ? { documentFingerprint: position.documentFingerprint } : {}) }
        latest.current.set(key, captured)
        pending.current.set(key, captured)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(flush, 300)
    }, [flush, key])
    const getInitialPosition = useCallback(() => {
        if (!key || current.current !== key) return null
        return latest.current.get(key) ?? seed.position
    }, [key, seed.position])
    return { initialPosition: seed.position, getInitialPosition, onPositionChange, storageUnavailable: key ? status.get(key) ?? seed.unavailable : false }
}
