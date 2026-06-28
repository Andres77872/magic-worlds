import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppVersionCheck } from './useAppVersionCheck'

const currentBuild: MagicWorldsBuildInfo = {
    buildId: 'current-build',
    commit: 'current-commit',
    branch: 'main',
    builtAt: '2026-06-17T00:00:00.000Z',
    source: 'cloudflare-pages',
}

const nextBuild: MagicWorldsBuildInfo = {
    ...currentBuild,
    buildId: 'next-build',
    commit: 'next-commit',
    builtAt: '2026-06-17T00:02:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('useAppVersionCheck', () => {
    it('stays quiet when the remote build matches the current build', async () => {
        const fetcher = vi.fn(async () => jsonResponse(currentBuild))

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher }),
        )

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

        expect(result.current.updateAvailable).toBe(false)
    })

    it('reports an available update when the remote build differs', async () => {
        const fetcher = vi.fn(async () => jsonResponse(nextBuild))

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher }),
        )

        await waitFor(() => expect(result.current.updateAvailable).toBe(true))
    })

    it('ignores failed checks and malformed responses', async () => {
        const fetcher = vi
            .fn(async () => jsonResponse(currentBuild))
            .mockResolvedValueOnce(jsonResponse({ nope: true }))
            .mockResolvedValueOnce(jsonResponse(currentBuild, 503))
            .mockResolvedValueOnce(new Response('not json', { status: 200 }))

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher, versionUrl: '/version.json' }),
        )

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
        await act(async () => result.current.checkNow())
        await act(async () => result.current.checkNow())

        expect(fetcher).toHaveBeenCalledTimes(3)
        expect(result.current.updateAvailable).toBe(false)
    })

    it('checks again when the browser comes online', async () => {
        let remoteBuild = currentBuild
        const fetcher = vi.fn(async () => jsonResponse(remoteBuild))

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher }),
        )

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

        remoteBuild = nextBuild
        act(() => window.dispatchEvent(new Event('online')))

        await waitFor(() => expect(result.current.updateAvailable).toBe(true))
        expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('checks again when the tab becomes visible', async () => {
        let remoteBuild = currentBuild
        const fetcher = vi.fn(async () => jsonResponse(remoteBuild))
        const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher }),
        )

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

        remoteBuild = nextBuild
        act(() => document.dispatchEvent(new Event('visibilitychange')))

        await waitFor(() => expect(result.current.updateAvailable).toBe(true))
        expect(fetcher).toHaveBeenCalledTimes(2)
        visibilitySpy.mockRestore()
    })

    it('shows the update state for Vite preload errors', async () => {
        const fetcher = vi.fn(async () => jsonResponse(currentBuild))

        const { result } = renderHook(() =>
            useAppVersionCheck({ currentBuildInfo: currentBuild, enabled: true, fetcher }),
        )

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

        const event = new Event('vite:preloadError', { cancelable: true })
        const preventDefault = vi.spyOn(event, 'preventDefault')

        act(() => window.dispatchEvent(event))

        expect(preventDefault).toHaveBeenCalled()
        await waitFor(() => expect(result.current.updateAvailable).toBe(true))
    })
})
