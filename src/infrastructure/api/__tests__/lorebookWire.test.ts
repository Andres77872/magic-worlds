import { describe, expect, it } from 'vitest'
import type { Lorebook, LorebookResource } from '@/shared'
import {
    serializeActivationPreview,
    serializeLorebookAttachment,
    serializeLorebookResource,
    serializeLorebookSnapshot,
} from '../lorebookWire'

const resource: LorebookResource = {
    id: 'resource-1',
    title: 'Moon notes',
    description: null,
    triggers: ['moon'],
    fileName: 'moon.md',
    fileType: 'md',
    content: '# Moon',
    contentLength: 6,
    createdAt: 'never-send',
}

const lorebook: Lorebook = {
    id: 'lorebook-1',
    name: 'Moon Codex',
    description: null,
    tags: ['night'],
    enabled: true,
    settings: {
        scanDepth: 8,
        tokenBudget: 1200,
        recursiveScanning: false,
        matchWholeWords: true,
        caseSensitive: false,
    },
    entries: [{
        id: 'entry-1',
        lorebookId: 'lorebook-1',
        title: 'Moon',
        entryType: 'world',
        content: 'The moon remembers.',
        keys: ['moon'],
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        revealCondition: null,
        insertionOrder: 0,
        priority: 1,
        insertionPosition: 'before_context',
        tokenBudget: null,
        metadata: { clientOnly: true },
        createdAt: 'never-send',
    }],
    attachments: [{
        id: 'old-attachment',
        lorebookId: 'lorebook-1',
        targetKind: 'global',
        targetId: null,
        mode: 'linked',
    }],
    metadata: {
        resources: [resource],
        sharedResources: [{ id: 'hydrated-client-only' }],
        clientOnly: true,
    },
    createdAt: 'never-send',
    updatedAt: 'never-send',
}

describe('lorebook wire serializers', () => {
    it('creates a stored immutable snapshot with required identities only', () => {
        expect(serializeLorebookSnapshot(lorebook)).toEqual({
            id: 'lorebook-1',
            name: 'Moon Codex',
            description: null,
            tags: ['night'],
            enabled: true,
            settings: lorebook.settings,
            metadata: {
                resources: [{
                    id: 'resource-1',
                    title: 'Moon notes',
                    description: null,
                    triggers: ['moon'],
                    fileName: 'moon.md',
                    fileType: 'md',
                    content: '# Moon',
                    contentLength: 6,
                }],
            },
            entries: [{
                id: 'entry-1',
                title: 'Moon',
                entryType: 'world',
                content: 'The moon remembers.',
                keys: ['moon'],
                secondaryKeys: [],
                selectiveLogic: 'any',
                enabled: true,
                constant: false,
                caseSensitive: false,
                matchWholeWords: true,
                regex: false,
                isSecret: false,
                revealCondition: null,
                insertionOrder: 0,
                priority: 1,
                insertionPosition: 'before_context',
                tokenBudget: null,
            }],
        })
    })

    it('reuses snapshots for attachments and activation overrides', () => {
        const snapshot = serializeLorebookSnapshot(lorebook)
        expect(serializeLorebookAttachment({
            lorebookId: lorebook.id,
            targetKind: 'global',
            targetId: null,
            mode: 'snapshot',
            snapshot: lorebook,
        })).toEqual({
            lorebookId: 'lorebook-1',
            targetKind: 'global',
            targetId: null,
            mode: 'snapshot',
            snapshot,
        })
        expect(serializeActivationPreview({
            targetKind: 'global',
            targetId: null,
            messages: [],
            overrides: { lorebooks: [lorebook] },
        })).toEqual({
            targetKind: 'global',
            targetId: null,
            messages: [],
            includePromptPreview: false,
            overrides: { lorebooks: [snapshot], includeDisabled: false },
        })
    })

    it('preserves optional resource identity on create and omits it on update', () => {
        expect(serializeLorebookResource(resource as LorebookResource & Record<string, unknown>, { includeIdentity: true })).toHaveProperty('id', 'resource-1')
        expect(serializeLorebookResource(resource as LorebookResource & Record<string, unknown>, { includeIdentity: false })).not.toHaveProperty('id')
    })
})
