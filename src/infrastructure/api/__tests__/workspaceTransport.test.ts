import { authSession } from '@/infrastructure/api/authSession'
import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ApiError,
    apiService,
    isWorkspaceApiError,
    setWorkspaceWritesBlocked,
    WORKSPACE_REQUIRED_EVENT,
    WorkspaceApiError,
} from '../index'

const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const WS_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const COLLECTION = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

function headersAt(index: number): Record<string, string> {
    return (fetchMock.mock.calls[index][1] as RequestInit).headers as Record<string, string>
}

function urlAt(index: number): string {
    return String(fetchMock.mock.calls[index][0])
}

function workspace(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id, name: 'Main', description: null, preferred_use: 'library', is_default: id === WS_A, archived_at: null,
        row_version: 3, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...overrides,
    }
}

describe('workspace-scoped transport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        authSession.authenticate('u1', 'old-token'); grantFixtureFeatures(true)
        localStorage.setItem('magic_worlds:user', JSON.stringify({ username: 'nyra' }))
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        setWorkspaceWritesBlocked(false)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        setWorkspaceWritesBlocked(false)
    })

    it('sends the captured workspace on every private request while the singleton stays unscoped', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ id: 3 }))
        const scoped = apiService.withWorkspace(WS_A)

        await scoped.getAdventureSession(3)
        await apiService.getAdventureSession(3)

        expect(headersAt(0)['X-Workspace-Id']).toBe(WS_A)
        expect(headersAt(0)).not.toHaveProperty('X-Initial-Collection-Ids')
        expect(headersAt(1)).not.toHaveProperty('X-Workspace-Id')
        expect(apiService.workspaceScope).toBeNull()
        expect(scoped.workspaceScope).toEqual({ workspaceId: WS_A, initialCollectionIds: [] })
    })

    it('checks source status in the explicit workspace using read-only metadata transport', async () => {
        const cards = [{ card_type: 'character' as const, card_id: 'c1' }]
        const result = { items: [{ ...cards[0], available: false, latest_version_id: null, latest_version_number: null, has_draft: null }] }
        fetchMock.mockResolvedValueOnce(jsonResponse(result))
        expect(await apiService.withWorkspace(WS_A).getCardSourceStatuses(WS_B, cards)).toEqual(result)
        expect(urlAt(0)).toMatch(new RegExp(`/workspaces/${WS_B}/cards/source-status$`))
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ cards })
        expect(fetchMock.mock.calls[0][1].cache).toBe('no-store')
    })

    it('keeps the captured workspace on the replay after an auth refresh', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
            .mockResolvedValueOnce(jsonResponse({
                success: true, access_token: 'new-token', accessible_projects: [],
                user: { user_hash: 'u1', username: 'nyra', user_type: 'consumer', created_at: null, updated_at: null },
            }))
            .mockResolvedValueOnce(jsonResponse({ id: 3 }))

        await apiService.withWorkspace(WS_B).getAdventureSession(3)

        expect(urlAt(1)).toMatch(/\/auth\/refresh$/)
        expect(headersAt(1)).not.toHaveProperty('X-Workspace-Id')
        expect(headersAt(2)['X-Workspace-Id']).toBe(WS_B)
        expect(headersAt(2).Authorization).toBe('Bearer new-token')
    })

    it('scopes authenticated blobs too', async () => {
        fetchMock.mockResolvedValueOnce(new Response(new Blob(['png']), { status: 200, headers: { 'Content-Type': 'image/png' } }))
        await apiService.withWorkspace(WS_A).exportCardImage('character', 'c1')
        expect(headersAt(0)['X-Workspace-Id']).toBe(WS_A)
    })

    it('validates scopes and never stacks one scoped client on another', () => {
        expect(() => apiService.withWorkspace('not-a-uuid')).toThrow()
        expect(() => apiService.withWorkspace(WS_A.toUpperCase())).toThrow()
        expect(() => apiService.withWorkspace(WS_A, { initialCollectionIds: [COLLECTION, COLLECTION] })).toThrow()
        expect(() => apiService.withWorkspace(WS_A, {
            initialCollectionIds: Array.from({ length: 21 }, (_, index) => `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`),
        })).toThrow()

        const scoped = apiService.withWorkspace(WS_A)
        const rescoped = scoped.withWorkspace(WS_B)
        expect(Object.getPrototypeOf(rescoped)).toBe(apiService)
        expect(rescoped.workspaceScope?.workspaceId).toBe(WS_B)
        expect(scoped.workspaceScope?.workspaceId).toBe(WS_A)
        expect(() => { (scoped as unknown as { workspaceScope: unknown }).workspaceScope = null }).toThrow()
    })

    it('sends initial collections as one comma-joined header', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 3 }))
        await apiService.withWorkspace(WS_A, { initialCollectionIds: [COLLECTION, WS_B] }).getAdventureSession(3)
        expect(headersAt(0)['X-Initial-Collection-Ids']).toBe(`${COLLECTION},${WS_B}`)
    })

    it('selects workspace routes by path only, with a quoted If-Match version', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ items: [workspace(WS_A)], default_workspace_id: WS_A }))
            .mockResolvedValueOnce(jsonResponse(workspace(WS_B, { name: 'Renamed', row_version: 4 })))
            .mockResolvedValueOnce(jsonResponse(workspace(WS_B, { archived_at: '2026-10-05T00:00:00Z', row_version: 5 })))

        const scoped = apiService.withWorkspace(WS_A)
        await scoped.listWorkspaces({ includeArchived: true })
        await scoped.updateWorkspace(WS_B, 3, { name: 'Renamed' })
        await scoped.archiveWorkspace(WS_B, 4)

        expect(urlAt(0)).toMatch(/\/workspaces\?include_archived=true$/)
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
        expect(urlAt(1)).toMatch(new RegExp(`/workspaces/${WS_B}$`))
        expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PATCH')
        expect(headersAt(1)['If-Match']).toBe('"3"')
        expect(headersAt(1)).not.toHaveProperty('X-Workspace-Id')
        expect(urlAt(2)).toMatch(new RegExp(`/workspaces/${WS_B}/archive$`))
        expect(headersAt(2)['If-Match']).toBe('"4"')
    })

    it('rejects a malformed workspace list instead of guessing a default', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ items: [workspace(WS_B)], default_workspace_id: WS_A }))
        await expect(apiService.listWorkspaces()).rejects.toMatchObject({ status: 502, code: 'workspace_contract' })
    })

    it('reports a copy replay (200 + X-Idempotent-Replay) separately from a first copy (201)', async () => {
        const result = {
            request_id: 'copy-1', source_workspace_id: WS_A, destination_workspace_id: WS_B,
            cards: [{ source: { card_type: 'world', card_id: 'w1' }, destination: { card_type: 'world', card_id: 'w2' } }],
            lorebooks: [], resources: [],
        }
        fetchMock
            .mockResolvedValueOnce(jsonResponse(result, { status: 201 }))
            .mockResolvedValueOnce(jsonResponse(result, { status: 200, headers: { 'X-Idempotent-Replay': 'true' } }))
        const command = {
            request_id: 'copy-1', source_workspace_id: WS_A,
            cards: [{ card_type: 'world' as const, card_id: 'w1' }], destination_collection_ids: [COLLECTION],
        }

        await expect(apiService.copyCardsToWorkspace(WS_B, command)).resolves.toEqual({ result, replayed: false })
        await expect(apiService.copyCardsToWorkspace(WS_B, command)).resolves.toEqual({ result, replayed: true })
        expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
            request_id: 'copy-1', source_workspace_id: WS_A,
            cards: [{ card_type: 'world', card_id: 'w1' }], destination_collection_ids: [COLLECTION],
        })
        await expect(apiService.copyCardsToWorkspace(WS_B, { ...command, cards: [] })).rejects.toThrow()
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('throws typed workspace errors and announces WORKSPACE_REQUIRED', async () => {
        const required = vi.fn()
        window.addEventListener(WORKSPACE_REQUIRED_EVENT, required)
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ detail: { code: 'WORKSPACE_ARCHIVED' } }, { status: 409 }))
            .mockResolvedValueOnce(jsonResponse({ detail: { code: 'WORKSPACE_REQUIRED' } }, { status: 422 }))
            .mockResolvedValueOnce(jsonResponse({ detail: { code: 'something_else' } }, { status: 409 }))

        const archived = await apiService.withWorkspace(WS_A).deleteCharacter('c1').catch((error: unknown) => error)
        expect(archived).toBeInstanceOf(WorkspaceApiError)
        expect(isWorkspaceApiError(archived, 'WORKSPACE_ARCHIVED')).toBe(true)
        expect((archived as WorkspaceApiError).status).toBe(409)

        const missing = await apiService.getAdventureSession(3).catch((error: unknown) => error)
        expect(isWorkspaceApiError(missing, 'WORKSPACE_REQUIRED')).toBe(true)
        expect(required).toHaveBeenCalledOnce()

        const other = await apiService.withWorkspace(WS_A).getAdventureSession(3).catch((error: unknown) => error)
        expect(other).toBeInstanceOf(ApiError)
        expect(other).not.toBeInstanceOf(WorkspaceApiError)
        window.removeEventListener(WORKSPACE_REQUIRED_EVENT, required)
    })

    it('refuses private writes locally once the tab is stale, but keeps reads', async () => {
        setWorkspaceWritesBlocked(true)
        fetchMock.mockResolvedValue(jsonResponse({ id: 3 }))
        const scoped = apiService.withWorkspace(WS_A)

        await expect(scoped.deleteCharacter('c1')).rejects.toMatchObject({ code: 'workspace_client_stale' })
        await expect(apiService.createWorkspace({ name: 'New' })).rejects.toMatchObject({ code: 'workspace_client_stale' })
        await expect(scoped.getAdventureSession(3)).resolves.toEqual({ id: 3 })
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
