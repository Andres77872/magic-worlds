import { useCallback, useEffect, useState } from 'react'

const DEFAULT_CHECK_INTERVAL_MS = 2 * 60 * 1000

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

    const checkNow = useCallback(async () => {
        if (!enabled || updateAvailable || !fetcher) return

        try {
            const separator = versionUrl.includes('?') ? '&' : '?'
            const response = await fetcher(`${versionUrl}${separator}ts=${Date.now()}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
            })

            if (!response.ok) return

            const remoteBuildInfo: unknown = await response.json()
            if (isBuildInfo(remoteBuildInfo) && remoteBuildInfo.buildId !== currentBuildInfo.buildId) {
                setUpdateAvailable(true)
            }
        } catch {
            // Version checks are advisory; failed checks must not interrupt the app.
        }
    }, [currentBuildInfo.buildId, enabled, fetcher, updateAvailable, versionUrl])

    useEffect(() => {
        if (!enabled || updateAvailable) return

        void checkNow()
        const intervalId = window.setInterval(() => void checkNow(), intervalMs)

        return () => window.clearInterval(intervalId)
    }, [checkNow, enabled, intervalMs, updateAvailable])

    useEffect(() => {
        if (!enabled || updateAvailable) return

        const checkOnVisible = () => {
            if (document.visibilityState === 'visible') void checkNow()
        }

        const checkOnWindowEvent = () => void checkNow()

        window.addEventListener('focus', checkOnWindowEvent)
        window.addEventListener('online', checkOnWindowEvent)
        document.addEventListener('visibilitychange', checkOnVisible)

        return () => {
            window.removeEventListener('focus', checkOnWindowEvent)
            window.removeEventListener('online', checkOnWindowEvent)
            document.removeEventListener('visibilitychange', checkOnVisible)
        }
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
