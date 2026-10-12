/**
 * Workspace R1: `organization` is server-owned read metadata. Lorebook and
 * resource write bodies (the backend request models reject it with 422),
 * attachment snapshots, activation previews and assistant prompts never carry it.
 */
import { describe, expect, it } from 'vitest'
import { serializeActivationPreview, serializeLorebookAttachment, serializeLorebookResource } from '@/infrastructure/api/lorebookWire'
import type { Lorebook, LorebookResource } from '@/shared'
import { OTHER_WORKSPACE_ID, TEST_WORKSPACE_ID } from '@/shared/hooks/testing/workspaceTestUtils'
import { lorebookAssistantAdapter } from './lorebookAssistantAdapter'
import { lorebookResourceToApiPayload, normalizeLorebookResource } from './lorebookResources'
import { DEFAULT_LOREBOOK_SETTINGS, entryToApiPayload, lorebookToApiPayload, normalizeLorebook } from './lorebookTransforms'

const ORGANIZATION = { workspace_id: TEST_WORKSPACE_ID }

function resource(overrides: Partial<LorebookResource> = {}): LorebookResource {
    return {
        id: 'resource-1',
        title: 'Court archive',
        description: 'Old court law.',
        triggers: ['court archive'],
        fileName: 'court.md',
        fileType: 'md',
        content: 'Never bargain under blue glass.',
        extractionStatus: 'pending',
        extraction: null,
        organization: ORGANIZATION,
        ...overrides,
    }
}

function lorebook(): Lorebook {
    return {
        id: 'lb-1',
        name: 'Glass Courts',
        description: 'Moonlit court law.',
        tags: ['court'],
        enabled: true,
        settings: { ...DEFAULT_LOREBOOK_SETTINGS },
        entries: [],
        attachments: [],
        // A server-shaped embedded resource carrying metadata of its own.
        metadata: { resources: [{ ...resource(), organization: { workspace_id: OTHER_WORKSPACE_ID } }] },
        organization: ORGANIZATION,
    }
}

/** No key named `organization` or `workspace_id` anywhere in the body. */
function expectNoOrganization(body: unknown) {
    const keys: string[] = []
    JSON.stringify(body, (key, value) => { keys.push(key); return value })
    expect(keys).not.toContain('organization')
    expect(keys).not.toContain('workspace_id')
}

describe('lorebook write bodies omit workspace organization', () => {
    it('keeps organization on reads', () => {
        expect(normalizeLorebook({ ...lorebook(), organization: ORGANIZATION }).organization).toEqual(ORGANIZATION)
        expect(normalizeLorebookResource({ ...resource(), organization: ORGANIZATION })?.organization).toEqual(ORGANIZATION)
    })

    it('serializes a lorebook (create/update body) without it', () => {
        const book = normalizeLorebook(lorebook())
        expect(book.organization).toEqual(ORGANIZATION)
        const body = { ...lorebookToApiPayload(book), entries: book.entries.map(entryToApiPayload) }
        expect(body).toMatchObject({ name: 'Glass Courts', metadata: { resources: [expect.objectContaining({ id: 'resource-1' })] } })
        expectNoOrganization(body)
    })

    it('serializes a resource (create and update bodies) without it', () => {
        const created = lorebookResourceToApiPayload(resource())
        expect(created).toMatchObject({ id: 'resource-1', fileName: 'court.md', content: 'Never bargain under blue glass.' })
        expectNoOrganization(created)
        const updated = serializeLorebookResource({ ...resource() }, { includeIdentity: false })
        expect(updated).toMatchObject({ title: 'Court archive', fileType: 'md' })
        expectNoOrganization(updated)
    })

    it('serializes attachment snapshots and activation previews without it', () => {
        const book = lorebook()
        expectNoOrganization(serializeLorebookAttachment({ lorebookId: 'lb-1', targetKind: 'global', mode: 'snapshot', snapshot: book }))
        expectNoOrganization(serializeActivationPreview({
            targetKind: 'global',
            messages: [{ role: 'user', content: 'glass' }],
            overrides: { lorebooks: [book] },
        }))
    })

    it('never puts it into the lorebook assistant prompt', () => {
        const book = lorebook()
        const body = lorebookAssistantAdapter.turnBody({ targetId: 'lb-1', title: 'Glass Courts', current: book }, 'Add a guild', null)
        expect(body.current).toMatchObject({ id: 'lb-1', name: 'Glass Courts' })
        expectNoOrganization(body)
    })
})
