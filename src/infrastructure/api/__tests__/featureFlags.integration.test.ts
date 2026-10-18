import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import { authSession } from '../authSession'

const WORKSPACE = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const fetchMock = vi.fn()
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
    setAllTestFeatureFlags(true)
    localStorage.setItem('magic_worlds:token', 'feature-flags-test-token')
    fetchMock.mockReset().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear() })

describe('frontend dispatch with disabled product features', () => {
    it('allows owner exposure withdrawal with community and adventure permissions off', async () => {
        setAllTestFeatureFlags(false)
        fetchMock.mockImplementation(async () => json({}))
        await apiService.withWorkspace(WORKSPACE).revokeSharedCardLink('owned-share')
        await apiService.withWorkspace(WORKSPACE).unpublishCard('adventure_template', 'owned-template')
        expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['DELETE', 'DELETE'])
    })
    it('continues filtered Library pages in scope and invalidates them after a private write or account change', async () => {
        setTestFeatureFlags({ adventures: false })
        let rows = Array.from({ length: 125 }, (_, index) => ({
            card_type: 'character', card: { id: `visible-${index}`, organization: { workspace_id: WORKSPACE, collection_ids: [] } },
        }))
        fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
            if (init.method === 'DELETE') { rows = rows.slice(1); return json({}) }
            const query = new URL(url).searchParams
            const type = query.get('card_type')
            const matching = rows.filter(row => !type || row.card_type === type)
            const offset = Number(query.get('offset') ?? 0)
            const limit = Number(query.get('limit') ?? 24)
            return json({ items: matching.slice(offset, offset + limit), total: matching.length, limit, offset })
        })
        const api = apiService.withWorkspace(WORKSPACE)
        await api.listLibraryCards(WORKSPACE, { limit: 24 })
        expect(fetchMock).toHaveBeenCalledTimes(4)
        await api.listLibraryCards(WORKSPACE, { limit: 24, offset: 24 })
        expect(fetchMock).toHaveBeenCalledTimes(4)
        await api.deleteCharacter('visible-0')
        expect((await api.listLibraryCards(WORKSPACE, { limit: 24, offset: 24 })).items[0].card.id).toBe('visible-25')
        expect(fetchMock).toHaveBeenCalledTimes(9)
        expect((fetchMock.mock.calls[4][1].headers as Record<string, string>)['X-Workspace-Id']).toBe(WORKSPACE)
        authSession.authenticate('another-feature-test-user', 'another-feature-test-token')
        await api.listLibraryCards(WORKSPACE, { limit: 24, offset: 24 })
        expect(fetchMock).toHaveBeenCalledTimes(13)
        expect((fetchMock.mock.calls[9][1].headers as Record<string, string>).Authorization).toBe('Bearer another-feature-test-token')
    })
    it('blocks community reads, publication, sharing and imports before dispatch', async () => {
        setTestFeatureFlags({ communityCards: false })
        const api = apiService.withWorkspace(WORKSPACE)
        await expect(api.listPublicCards()).rejects.toThrow('disabled')
        await expect(api.publishCard('character', 'card')).rejects.toThrow('disabled')
        await expect(api.createCardShareLink('character', 'card')).rejects.toThrow('disabled')
        await expect(api.getSharedCard('token')).rejects.toThrow('disabled')
        await expect(api.importSharedCard('token')).rejects.toThrow('disabled')
        await expect(api.cloneCard('character', 'card')).rejects.toThrow('disabled')
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it('sends no voice or call request when voices are off and calls are on', async () => {
        setTestFeatureFlags({ voices: false })
        const api = apiService.withWorkspace(WORKSPACE)
        await expect(api.getVoiceCapabilities()).rejects.toThrow('Voices are disabled.')
        await expect(api.getTtsJob('job')).rejects.toThrow('Voices are disabled.')
        await expect(api.fetchTtsAudioBlob('/tts/assets/audio.mp3')).rejects.toThrow('Voices are disabled.')
        await expect(api.getRecentVoiceCalls()).rejects.toThrow('Calls are disabled.')
        await expect(api.saveVoiceConsent(1)).rejects.toThrow('Calls are disabled.')
        await expect(api.getSessionVoiceSettings('character-chats', 1)).rejects.toThrow()
        await expect(api.testLlmProfile('profile', { kind: 'published', revisionId: 'rev' }, 'callbot', 'request', false)).rejects.toThrow()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('blocks disabled adventure, group and resource writes before dispatch', async () => {
        setTestFeatureFlags({ adventures: false })
        setTestFeatureFlags({ groupChats: false })
        setTestFeatureFlags({ lorebooks: false })
        const api = apiService.withWorkspace(WORKSPACE)
        await expect(api.createAdventureTemplate({})).rejects.toThrow('Adventures are disabled.')
        await expect(api.duplicateCard('adventure_template', 'card')).rejects.toThrow()
        await expect(api.publishCard('adventure_template', 'card')).rejects.toThrow()
        await expect(api.createCharacterGroupChat(['a', 'b'], 'persona')).rejects.toThrow()
        await expect(api.getLorebookResources()).rejects.toThrow()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('keeps default-workspace discovery and scoped private requests with every flag off', async () => {
        setAllTestFeatureFlags(false)
        fetchMock.mockImplementation(async (url: string) => json(url.includes('/workspaces/capabilities') ? { workspace_r1: true } : []))
        await apiService.getWorkspaceCapabilities()
        await apiService.withWorkspace(WORKSPACE).getCharacters()
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
        expect(url).toContain('/characters/')
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBe(WORKSPACE)
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer feature-flags-test-token')
        fetchMock.mockResolvedValueOnce(json({ items: [] }))
        await apiService.listCollections(WORKSPACE)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('filters disabled LLM contracts from a server catalog', async () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ novels: false })
        fetchMock.mockResolvedValueOnce(json({ features: ['callbot', 'moderation', 'novel', 'chat_character'].map(feature_key => ({ feature_key })) }))
        expect((await apiService.getLlmFeatures()).features.map(feature => feature.feature_key)).toEqual(['moderation', 'chat_character'])
    })

    it('hides disabled tasks without discarding the raw pagination cursor', async () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ adventures: false })
        const items = [
            { task_id: 'narration', operation: 'text_to_speech', target: { type: 'character', id: 'card' } },
            { task_id: 'adventure', operation: 'theme_song', target: { type: 'adventure_template', id: 'card' } },
            { task_id: 'character', operation: 'theme_song', target: { type: 'character', id: 'card' } },
        ]
        fetchMock.mockResolvedValueOnce(json({ items, limit: 3, offset: 0, next_offset: 3 }))
        const page = await apiService.withWorkspace(WORKSPACE).listTasks({ operation: 'all', limit: 3 })

        expect(page.items.map(task => task.task_id)).toEqual(['character'])
        expect(page.next_offset).toBe(3)
        await expect(apiService.getTask('text_to_speech', 'narration')).rejects.toThrow('disabled')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
