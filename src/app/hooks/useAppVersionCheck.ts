import { useCallback, useEffect, useRef, useState } from 'react'
import { isPageFocused, usePageFocus } from './usePageFocus'

const DEFAULT_CHECK_INTERVAL_MS = 2 * 60 * 1000

/** Window event that asks every mounted version check to run immediately. */
export const APP_VERSION_CHECK_EVENT = 'app:version-check'

/**
 * Runs the `/version.json` check now instead of on the next poll (document 08:
 * a stale workspace contract or a `WORKSPACE_REQUIRED` response).
 */
export function requestAppVersionCheck(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(APP_VERSION_CHECK_EVENT))
}

const FALLBACK_BUILD_INFO: MagicWorldsBuildInfo = {
    buildId: 'local-dev',
    commit: null,
    branch: null,
    builtAt: 'local-dev',
    source: 'local',
}

type VersionFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface UseAppVersionCheckOptions {
    currentBuildInfo?: MagicWorldsBuildInfo
    enabled?: boolean
    fetcher?: VersionFetcher
    intervalMs?: number
    versionUrl?: string
}

interface UseAppVersionCheckResult {
    updateAvailable: boolean
    checkNow: () => Promise<void>
}

function getCurrentBuildInfo(): MagicWorldsBuildInfo {
    return typeof __MW_BUILD_INFO__ === 'undefined' ? FALLBACK_BUILD_INFO : __MW_BUILD_INFO__
}

function isBuildInfo(value: unknown): value is MagicWorldsBuildInfo {
    if (!value || typeof value !== 'object') return false

    const candidate = value as Partial<MagicWorldsBuildInfo>
    return (
        typeof candidate.buildId === 'string' &&
        typeof candidate.builtAt === 'string' &&
        (candidate.commit === null || typeof candidate.commit === 'string') &&
        (candidate.branch === null || typeof candidate.branch === 'string') &&
        (candidate.source === 'cloudflare-pages' || candidate.source === 'local')
    )
}

export function useAppVersionCheck(options: UseAppVersionCheckOptions = {}): UseAppVersionCheckResult {
    const currentBuildInfo = options.currentBuildInfo ?? getCurrentBuildInfo()
    const enabled = options.enabled ?? import.meta.env.PROD
    const fetcher = options.fetcher ?? (typeof fetch === 'undefined' ? null : fetch)
    const intervalMs = options.intervalMs ?? DEFAULT_CHECK_INTERVAL_MS
    const versionUrl = options.versionUrl ?? '/version.json'
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const pageFocused = usePageFocus()
    const inFlightRef = useRef<AbortController | null>(null)

    const checkNow = useCallback(async () => {
        if (!enabled || updateAvailable || !fetcher || inFlightRef.current) return
        const controller = new AbortController()
        inFlightRef.current = controller

        try {
            const separator = versionUrl.includes('?') ? '&' : '?'
            const response = await fetcher(`${versionUrl}${separator}ts=${Date.now()}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })

            if (!response.ok) return

            const remoteBuildInfo: unknown = await response.json()
            if (!controller.signal.aborted && isBuildInfo(remoteBuildInfo) && remoteBuildInfo.buildId !== currentBuildInfo.buildId) {
                setUpdateAvailable(true)
            }
        } catch {
            // Version checks are advisory; failed checks must not interrupt the app.
        } finally {
            if (inFlightRef.current === controller) inFlightRef.current = null
        }
    }, [currentBuildInfo.buildId, enabled, fetcher, updateAvailable, versionUrl])

    useEffect(() => {
        if (!enabled || updateAvailable || !pageFocused) return

        let active = true
        queueMicrotask(() => { if (active && isPageFocused()) void checkNow() })
        const intervalId = window.setInterval(() => { if (isPageFocused()) void checkNow() }, intervalMs)

        return () => {
            active = false
            window.clearInterval(intervalId)
            inFlightRef.current?.abort()
            inFlightRef.current = null
        }
    }, [checkNow, enabled, intervalMs, pageFocused, updateAvailable])

    useEffect(() => {
        if (!enabled || updateAvailable || !pageFocused) return
        const checkOnOnline = () => { if (isPageFocused()) void checkNow() }
        window.addEventListener('online', checkOnOnline)
        return () => window.removeEventListener('online', checkOnOnline)
    }, [checkNow, enabled, pageFocused, updateAvailable])

    useEffect(() => {
        if (!enabled || updateAvailable) return
        const checkOnRequest = () => void checkNow()
        window.addEventListener(APP_VERSION_CHECK_EVENT, checkOnRequest)
        return () => window.removeEventListener(APP_VERSION_CHECK_EVENT, checkOnRequest)
    }, [checkNow, enabled, updateAvailable])

    useEffect(() => {
        if (!enabled) return

        const handlePreloadError = (event: Event) => {
            event.preventDefault()
            setUpdateAvailable(true)
        }

        window.addEventListener('vite:preloadError', handlePreloadError)

        return () => window.removeEventListener('vite:preloadError', handlePreloadError)
    }, [enabled])

    return { updateAvailable, checkNow }
}
