import { describe, expect, it } from 'vitest'
import { assistantTurnFixture } from '@/test/assistantFixtures'
import { normalizeLorebookResource } from '@/features/lorebook/lorebookResources'
import { transformCharacters, transformWorlds } from '@/utils/cardTransforms'
import { verifyAssistantTurn } from '../assistantContract'
import { verifyCardGeneration } from '../cardContract'
import { verifyThemeSongJob } from '../themeSongContract'
import {
    canonicalInitialCollectionIds,
    classifyWorkspaceCapabilities,
    stripCardBodyOrganization,
    stripOrganization,
    verifyContentResolution,
    verifyLibraryPage,
    verifyWorkspaceList,
} from '../workspaceContract'

const WS = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const OTHER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const COLLECTION = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'
const CARD_ID = '11111111-1111-4111-8111-111111111111'

const generated = (extra: Record<string, unknown> = {}) => ({
    id: CARD_ID, name: 'Moonlit realm', description: 'A quiet forest.', request_id: 'card-1',
    llm_execution: { execution_id: CARD_ID, profile_id: '22222222-2222-4222-8222-222222222222',
        revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default',
        credential_mode: 'platform', replayed: false },
    ...extra,
})

const workspace = (id: string, extra: Record<string, unknown> = {}) => ({
    id, name: 'Main', description: null, preferred_use: 'library', is_default: id === WS, archived_at: null,
    row_version: 1, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...extra,
})

describe('capability handshake classification', () => {
    it('supports exactly the R1 contract, flags newer builds and blocks predecessors', () => {
        const supported = { workspace_r1: true, contract_version: 1, schema_revision: '2026_10_workspace_r1' }
        expect(classifyWorkspaceCapabilities(supported)).toBe('supported')
        expect(classifyWorkspaceCapabilities({ ...supported, contract_version: 2 })).toBe('newer')
        expect(classifyWorkspaceCapabilities({ ...supported, contract_version: 0 })).toBe('predecessor')
        expect(classifyWorkspaceCapabilities({ ...supported, workspace_r1: false })).toBe('predecessor')
        expect(classifyWorkspaceCapabilities({})).toBe('predecessor')
        expect(classifyWorkspaceCapabilities(null)).toBe('predecessor')
    })
})

describe('workspace DTO validation', () => {
    it('requires exactly one active default that matches default_workspace_id', () => {
        expect(verifyWorkspaceList({ items: [workspace(WS), workspace(OTHER)], default_workspace_id: WS })).toBe(true)
        expect(verifyWorkspaceList({ items: [workspace(WS), workspace(WS)], default_workspace_id: WS })).toBe(false)
        expect(verifyWorkspaceList({ items: [workspace(OTHER)], default_workspace_id: WS })).toBe(false)
        expect(verifyWorkspaceList({ items: [workspace(WS, { archived_at: '2026-10-02T00:00:00Z' })], default_workspace_id: WS })).toBe(false)
        expect(verifyWorkspaceList({ items: [{ ...workspace(WS), extra: 1 }], default_workspace_id: WS })).toBe(false)
    })

    it('checks library items belong to the requested workspace', () => {
        const page = (workspaceId: string) => ({
            items: [{ card_type: 'world', card: { id: 'w1', name: 'Realm', organization: { workspace_id: workspaceId, collection_ids: [COLLECTION] } } }],
            total: 1, limit: 24, offset: 0,
        })
        expect(verifyLibraryPage(page(WS), WS)).toBe(true)
        expect(verifyLibraryPage(page(OTHER), WS)).toBe(false)
    })

    it('matches content resolution to the requested kind and id', () => {
        const resolution = { workspace_id: WS, archived: false, kind: 'story', id: '42' }
        expect(verifyContentResolution(resolution, 'story', '42')).toBe(true)
        expect(verifyContentResolution(resolution, 'card', '42')).toBe(false)
        expect(verifyContentResolution({ ...resolution, archived: 'no' }, 'story', '42')).toBe(false)
    })

    it('canonicalizes initial collection IDs', () => {
        expect(canonicalInitialCollectionIds(undefined)).toEqual([])
        expect(canonicalInitialCollectionIds([COLLECTION])).toEqual([COLLECTION])
        expect(() => canonicalInitialCollectionIds([COLLECTION.toUpperCase()])).toThrow()
    })
})

describe('server-owned organization on private read DTOs', () => {
    it('accepts a generated card placed in the requesting workspace, with grouping warnings', () => {
        const organization = { workspace_id: WS, collection_ids: [COLLECTION] }
        expect(verifyCardGeneration(generated({ organization }), 'card-1', WS)).toBe(true)
        expect(verifyCardGeneration(generated({
            organization: { workspace_id: WS, collection_ids: [] },
            organization_warnings: [{ code: 'COLLECTION_REMOVED', collection_id: COLLECTION }],
        }), 'card-1', WS)).toBe(true)
        expect(verifyCardGeneration(generated({ organization }), 'card-1', OTHER)).toBe(false)
        expect(verifyCardGeneration(generated({ organization: { workspace_id: WS } }), 'card-1', WS)).toBe(false)
        expect(verifyCardGeneration(generated({ organization_warnings: [{ code: 'OTHER', collection_id: COLLECTION }] }), 'card-1')).toBe(false)
    })

    it('accepts a root organization on assistant conversations and theme-song jobs', () => {
        const body = structuredClone(assistantTurnFixture('app', 'req-1')) as unknown as Record<string, Record<string, unknown>>
        body.conversation.organization = { workspace_id: WS }
        expect(verifyAssistantTurn(body, 'app', 2, 'req-1')).toBe(true)
        body.conversation.organization = { workspace_id: WS, collection_ids: [] }
        expect(verifyAssistantTurn(body, 'app', 2, 'req-1')).toBe(false)

        const job = {
            job_id: 'song-1', target: { type: 'character', id: 'card-1', display_name: 'Sailor' },
            operation: 'theme_song', status: 'completed', model_alias: 'minimax_music_3', instrumental: false,
            status_url: '/theme-songs/jobs/song-1', result_url: '/theme-songs/jobs/song-1/result',
            lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 },
            assets: [{ asset_id: 'audio-1', url: '/theme-songs/assets/audio-1.mp3', content_type: 'audio/mpeg',
                output_format: 'mp3', file_size_bytes: 1024, duration_ms: 60000, sample_rate: 44100, channels: 2, bitrate: 192000 }],
            error: null, created_at: '2026-10-09T00:00:00', updated_at: '2026-10-09T00:01:00',
        }
        expect(verifyThemeSongJob(job)).toBe(true)
        expect(verifyThemeSongJob({ ...job, organization: { workspace_id: WS } })).toBe(true)
        expect(verifyThemeSongJob({ ...job, organization: { workspace_id: 'nope' } })).toBe(false)
    })

    it('keeps a valid organization through card and resource normalizers and drops malformed ones', () => {
        const [character] = transformCharacters([{ id: 'c1', name: 'Ada', organization: { workspace_id: WS, collection_ids: [] } }])
        expect(character.organization).toEqual({ workspace_id: WS, collection_ids: [] })
        const [world] = transformWorlds([{ id: 'w1', name: 'Realm', organization: { workspace_id: 'bad', collection_ids: [] } }])
        expect(world).not.toHaveProperty('organization')

        const resource = { id: 'r1', title: 'Notes', fileName: 'notes.txt', content: 'Hello' }
        expect(normalizeLorebookResource(resource)).not.toHaveProperty('organization')
        expect(normalizeLorebookResource({ ...resource, organization: { workspace_id: WS } })?.organization).toEqual({ workspace_id: WS })
        expect(normalizeLorebookResource({ ...resource, organization: { workspace_id: 'bad' } })).toBeNull()
    })

    it('never writes organization back, while keeping user attributes that happen to share the name', () => {
        const card = {
            name: 'Ada', organization: { workspace_id: WS, collection_ids: [] }, organization_warnings: [],
            persona: { name: 'Me', organization: { workspace_id: WS, collection_ids: [] } },
            characters: [{ name: 'Bo', organization: { workspace_id: WS, collection_ids: [] } }],
            world: { name: 'Realm', organization: { workspace_id: WS, collection_ids: [] } },
            attributes: { organization: 'Thieves guild' },
        }
        const stripped = stripCardBodyOrganization(card) as Record<string, unknown>
        expect(stripped).not.toHaveProperty('organization')
        expect(stripped).not.toHaveProperty('organization_warnings')
        expect(stripped.persona).toEqual({ name: 'Me' })
        expect(stripped.characters).toEqual([{ name: 'Bo' }])
        expect(stripped.world).toEqual({ name: 'Realm' })
        expect(stripped.attributes).toEqual({ organization: 'Thieves guild' })
        expect(card.organization).toBeDefined()
        expect(stripOrganization({ title: 'Story', organization: { workspace_id: WS } })).toEqual({ title: 'Story' })
    })
})
