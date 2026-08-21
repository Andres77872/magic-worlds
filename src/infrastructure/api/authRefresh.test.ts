import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from './index'
import { authSession } from './authSession'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        statusText: init.statusText,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

function headersOf(init: RequestInit): Record<string, string> {
    return init.headers as Record<string, string>
}

function fetchCallsFor(path: string): Array<[string, RequestInit]> {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes(path)) as Array<[string, RequestInit]>
}

function persistedStorageValues(): string {
    const values: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (key) values.push(`${key}:${localStorage.getItem(key) ?? ''}`)
    }
    return values.join('\n')
}

describe('auth refresh recovery API wrapper', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'old-token')
        localStorage.setItem('magic_worlds:user', JSON.stringify({ username: 'old-user' }))
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('refreshes protected GET 401 once, stores the new access token, and retries with updated Bearer', async () => {
        const expired = vi.fn()
        const refreshed: Array<Record<string, unknown>> = []
        window.addEventListener('auth:expired', expired)
        window.addEventListener('auth:refreshed', (event) => {
            refreshed.push((event as CustomEvent<Record<string, unknown>>).detail)
        })
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({
                success: true,
                message: 'Token refreshed successfully',
                access_token: 'new-token',
                refresh_token: 'must-not-persist',
                user: { user_hash: 'u1', username: 'nyra', user_type: 'consumer', created_at: null, updated_at: null },
                accessible_projects: [],
            }))
            .mockResolvedValueOnce(jsonResponse({ id: 3, name: 'Recovered session' }))

        const result = await apiService.getAdventureSession(3)

        expect(result).toEqual({ id: 3, name: 'Recovered session' })
        expect(fetchMock).toHaveBeenCalledTimes(3)
        const firstInit = fetchMock.mock.calls[0][1] as RequestInit
        const refreshInit = fetchMock.mock.calls[1][1] as RequestInit
        const retryInit = fetchMock.mock.calls[2][1] as RequestInit
        expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/refresh$/)
        expect(firstInit.credentials).toBeUndefined()
        expect(headersOf(firstInit).Authorization).toBe('Bearer old-token')
        expect(refreshInit.credentials).toBe('include')
        expect(headersOf(refreshInit).Authorization).toBe('Bearer old-token')
        expect(retryInit.credentials).toBeUndefined()
        expect(headersOf(retryInit).Authorization).toBe('Bearer new-token')
        expect(localStorage.getItem('magic_worlds:token')).toBe('new-token')
        expect(persistedStorageValues()).not.toContain('must-not-persist')
        expect(refreshed).toHaveLength(1)
        expect(refreshed[0]).not.toHaveProperty('refresh_token')
        expect(expired).not.toHaveBeenCalled()
    })

    it('keeps auth state when refresh succeeds but the retried protected request returns 401', async () => {
        const timeline: string[] = []
        const expired = vi.fn(() => timeline.push('auth:expired'))
        window.addEventListener('auth:expired', expired)
        fetchMock.mockImplementation((url: string, init: RequestInit) => {
            const auth = headersOf(init).Authorization
            if (String(url).endsWith('/auth/refresh')) {
                timeline.push('refresh')
                return Promise.resolve(jsonResponse({
                    success: true,
                    message: 'Token refreshed successfully',
                    access_token: 'new-token',
                }))
            }
            if (auth === 'Bearer old-token') {
                timeline.push('protected:first-401')
                return Promise.resolve(jsonResponse({ detail: 'expired' }, { status: 401 }))
            }
            if (auth === 'Bearer new-token') {
                timeline.push('protected:retry-401')
                return Promise.resolve(jsonResponse({ detail: 'still unauthorized' }, { status: 401 }))
            }
            throw new Error(`Unexpected request ${url} with auth ${auth ?? '<none>'}`)
        })

        await expect(apiService.getAdventureSession(3))
            .rejects.toMatchObject({ status: 401, message: 'still unauthorized' })

        expect(timeline).toEqual(['protected:first-401', 'refresh', 'protected:retry-401'])
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(1)
        const protectedCalls = fetchMock.mock.calls
            .filter(([url]) => String(url).includes('/adventure-sessions/3')) as Array<[string, RequestInit]>
        expect(protectedCalls).toHaveLength(2)
        expect(headersOf(protectedCalls[0][1]).Authorization).toBe('Bearer old-token')
        expect(headersOf(protectedCalls[1][1]).Authorization).toBe('Bearer new-token')
        expect(expired).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('new-token')
        expect(localStorage.getItem('magic_worlds:user')).toContain('old-user')
    })

    it('preserves protected mutation method and body when retrying after refresh', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', session_token: 'new-token' }))
            .mockResolvedValueOnce(jsonResponse({ ok: true }))

        await apiService.updateAdventureSessionMessage(8, 3, 'Updated narration')

        const firstInit = fetchMock.mock.calls[0][1] as RequestInit
        const retryInit = fetchMock.mock.calls[2][1] as RequestInit
        expect(firstInit.method).toBe('PATCH')
        expect(retryInit.method).toBe('PATCH')
        expect(JSON.parse(String(firstInit.body))).toEqual({ content: 'Updated narration' })
        expect(JSON.parse(String(retryInit.body))).toEqual({ content: 'Updated narration' })
        expect(headersOf(retryInit).Authorization).toBe('Bearer new-token')
    })

    it('does not recursively refresh auth endpoint 401 responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid credentials' }, { status: 401 }))

        await expect(apiService.login({ username: 'nyra', password: 'wrong' }))
            .rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const loginInit = fetchMock.mock.calls[0][1] as RequestInit
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/login$/)
        expect(loginInit.credentials).toBe('include')
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(0)
    })

    it('dispatches one terminal auth expiry and does not retry when refresh is denied', async () => {
        const expired = vi.fn()
        window.addEventListener('auth:expired', expired)
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ detail: 'Authentication required.' }, { status: 401 }))

        await expect(apiService.updateAdventureSessionMessage(4, 9, 'Updated'))
            .rejects.toBeInstanceOf(ApiError)

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(localStorage.getItem('magic_worlds:token')).toBeNull()
        expect(localStorage.getItem('magic_worlds:user')).toBeNull()
    })

    it('rejects a protected GET when refresh is terminally denied', async () => {
        const expired = vi.fn()
        window.addEventListener('auth:expired', expired)
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ detail: 'Authentication required.' }, { status: 401 }))

        await expect(apiService.getAdventureSession(4))
            .rejects.toMatchObject({ status: 401, message: 'Your session has expired. Please log in again.' })

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(localStorage.getItem('magic_worlds:token')).toBeNull()
        expect(localStorage.getItem('magic_worlds:user')).toBeNull()
    })

    it('surfaces transient refresh failure without clearing local auth state', async () => {
        const expired = vi.fn()
        window.addEventListener('auth:expired', expired)
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({ detail: 'Authentication service unavailable' }, { status: 503 }))

        await expect(apiService.updateAdventureSessionMessage(4, 9, 'Updated'))
            .rejects.toMatchObject({ status: 503, message: 'Authentication service unavailable' })

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(expired).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('old-token')
        expect(localStorage.getItem('magic_worlds:user')).toContain('old-user')
    })

    it('shares one refresh-in-flight promise across concurrent protected 401s', async () => {
        let resolveRefresh: (response: Response) => void = () => undefined
        const refreshResponse = new Promise<Response>((resolve) => {
            resolveRefresh = resolve
        })
        fetchMock.mockImplementation((url: string, init: RequestInit) => {
            if (url.endsWith('/auth/refresh')) return refreshResponse
            if (headersOf(init).Authorization === 'Bearer new-token') {
                return Promise.resolve(jsonResponse({ ok: url }))
            }
            return Promise.resolve(jsonResponse({ detail: 'expired' }, { status: 401 }))
        })

        const requests = Promise.all([
            apiService.getCharacter('1'),
            apiService.getWorld('2'),
            apiService.getAdventureTemplate('3'),
        ])

        await waitFor(() => expect(fetchCallsFor('/auth/refresh')).toHaveLength(1))
        resolveRefresh(jsonResponse({ success: true, message: 'ok', access_token: 'new-token' }))

        await expect(requests).resolves.toHaveLength(3)
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(1)
        const protectedCalls = fetchMock.mock.calls
            .filter(([url]) => !String(url).includes('/auth/refresh')) as Array<[string, RequestInit]>
        expect(protectedCalls).toHaveLength(6)
        expect(protectedCalls.slice(3).map(([, init]) => headersOf(init).Authorization))
            .toEqual(['Bearer new-token', 'Bearer new-token', 'Bearer new-token'])
    })

    it('retries once with an already-rotated token without starting another refresh', async () => {
        fetchMock.mockImplementation((_url: string, init: RequestInit) => {
            if (headersOf(init).Authorization === 'Bearer old-token') {
                localStorage.setItem('magic_worlds:token', 'rotated-token')
                return Promise.resolve(jsonResponse({ detail: 'expired' }, { status: 401 }))
            }
            return Promise.resolve(jsonResponse({ id: 3, name: 'Recovered session' }))
        })

        await expect(apiService.getAdventureSession(3)).resolves.toMatchObject({ id: 3 })

        expect(fetchCallsFor('/auth/refresh')).toHaveLength(0)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(headersOf(fetchMock.mock.calls[1][1] as RequestInit).Authorization).toBe('Bearer rotated-token')
    })

    it('never replays an old-account mutation after the auth owner changes', async () => {
        let resolveMutation: (response: Response) => void = () => undefined
        const pendingMutation = new Promise<Response>((resolve) => {
            resolveMutation = resolve
        })
        authSession.authenticate('account-a', 'old-token')
        localStorage.setItem('magic_worlds:user', JSON.stringify({ user_hash: 'account-a', username: 'a' }))
        fetchMock.mockReturnValueOnce(pendingMutation)

        const mutation = apiService.updateAdventureSessionMessage(4, 9, 'Account A edit')
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        authSession.beginLogout()
        authSession.finishLogout()
        authSession.authenticate('account-b', 'account-b-token')
        resolveMutation(jsonResponse({ detail: 'expired' }, { status: 401 }))

        await expect(mutation).rejects.toMatchObject({
            status: 401,
            code: 'auth_epoch_changed',
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(0)
        authSession.continueSignedOut()
    })

    it('orders refresh, logout, and quick login without persisting stale refresh completion', async () => {
        let resolveRefresh: (response: Response) => void = () => undefined
        const refreshResponse = new Promise<Response>((resolve) => {
            resolveRefresh = resolve
        })
        const refreshed = vi.fn()
        window.addEventListener('auth:refreshed', refreshed)
        authSession.authenticate('account-a', 'old-token')
        localStorage.setItem('magic_worlds:user', JSON.stringify({ user_hash: 'account-a', username: 'a' }))
        const timeline: string[] = []
        fetchMock.mockImplementation((url: string) => {
            if (url.endsWith('/auth/refresh')) {
                timeline.push('refresh')
                return refreshResponse
            }
            if (url.endsWith('/auth/logout')) {
                timeline.push('logout')
                return Promise.resolve(jsonResponse({ success: true }))
            }
            if (url.endsWith('/auth/login')) {
                timeline.push('login')
                return Promise.resolve(jsonResponse({
                    success: true,
                    access_token: 'account-b-token',
                    user: { user_hash: 'account-b', username: 'b' },
                }))
            }
            return Promise.resolve(jsonResponse({ detail: 'expired' }, { status: 401 }))
        })

        const mutation = apiService.updateAdventureSessionMessage(4, 9, 'Account A edit')
        await waitFor(() => expect(fetchCallsFor('/auth/refresh')).toHaveLength(1))
        const logout = apiService.logout()
        const login = apiService.login({ username: 'b', password: 'pw' })
        expect(timeline).toEqual(['refresh'])

        resolveRefresh(jsonResponse({
            success: true,
            access_token: 'stale-account-a-token',
            user: { user_hash: 'account-a', username: 'a' },
        }))

        await expect(mutation).rejects.toBeInstanceOf(ApiError)
        await logout
        await expect(login).resolves.toMatchObject({ success: true })
        expect(timeline).toEqual(['refresh', 'logout', 'login'])
        expect(localStorage.getItem('magic_worlds:token')).not.toBe('stale-account-a-token')
        expect(refreshed).not.toHaveBeenCalled()
        window.removeEventListener('auth:refreshed', refreshed)
        authSession.continueSignedOut()
    })

    it('keeps the request timeout active while a shared refresh is still pending', async () => {
        vi.useFakeTimers()
        let resolveRefresh: (response: Response) => void = () => undefined
        const refreshResponse = new Promise<Response>((resolve) => {
            resolveRefresh = resolve
        })
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockReturnValueOnce(refreshResponse)

        const caught = apiService.createCharacterAI('Generate safely', {
            requestId: 'req-refresh-timeout',
            idempotencyKey: 'idem-refresh-timeout',
            timeoutMs: 10,
        }).catch((error) => error)
        await vi.advanceTimersByTimeAsync(11)

        await expect(caught).resolves.toMatchObject({
            status: 0,
            category: 'timeout',
            code: 'ai_card_client_timeout',
        })
        resolveRefresh(jsonResponse({ detail: 'Authentication service unavailable' }, { status: 503 }))
        await vi.runAllTimersAsync()
    })

    it('uses credentialed requests for register, platform login, and logout lifecycle calls', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ success: true, message: 'ok' })))

        await apiService.register({ username: 'nyra', password: 'pw' })
        await apiService.platformLogin({ username: 'nyra', password: 'pw' })
        await apiService.logout()

        expect(fetchCallsFor('/auth/register')[0][1].credentials).toBe('include')
        expect(fetchCallsFor('/auth/platform/login')[0][1].credentials).toBe('include')
        expect(fetchCallsFor('/auth/logout')[0][1].credentials).toBe('include')
        expect(fetchCallsFor('/auth/refresh')).toHaveLength(0)
    })
})
