import { describe, expect, it } from 'vitest'
import type { Lorebook, LorebookResource } from '@/shared'
import { entryToApiPayload, lorebookToApiPayload, previewLocally, validateLorebookLocally } from './lorebookTransforms'

function book(overrides: Partial<Lorebook> = {}): Lorebook {
    return {
        id: 'book-1',
        name: 'Test lore',
        description: null,
        tags: [],
        enabled: true,
        settings: {
            scanDepth: 4,
            tokenBudget: 200,
            recursiveScanning: false,
            matchWholeWords: true,
            caseSensitive: false,
        },
        attachments: [],
        metadata: {},
        entries: [],
        ...overrides,
    }
}

function completedResource(overrides: Partial<LorebookResource> = {}): LorebookResource {
    return {
        id: 'resource-1',
        title: 'Glass archive',
        description: 'Source notes for the glass court.',
        triggers: ['glass archive'],
        fileName: 'glass-archive.md',
        fileType: 'md',
        content: 'The mirror oath binds court names.',
        contentLength: 36,
        extractionStatus: 'completed',
        extraction: {
            keywords: ['mirror court'],
            shortSummary: 'The glass archive describes court oaths.',
            longSummary: 'The mirror oath binds names spoken under the glass court.',
            notes: ['Names are binding.'],
            snippets: [
                {
                    id: 'snippet-1',
                    title: 'Mirror oath',
                    content: 'Names spoken under the mirror oath bind the speaker.',
                    triggers: ['mirror oath'],
                    source: 'glass-archive.md#oaths',
                },
            ],
        },
        ...overrides,
    }
}

describe('lorebook transforms', () => {
    it('preserves saved entry ids and omits temporary draft ids', () => {
        expect(entryToApiPayload({ id: 'entry-1', title: 'Saved' })).toMatchObject({ id: 'entry-1' })
        expect(entryToApiPayload({ id: 'draft-entry-1', title: 'Draft' })).not.toHaveProperty('id')
    })

    it('evaluates secondary keys, case sensitivity, and whole-word matching in local preview', () => {
        const lorebook = book({
            entries: [
                {
                    id: 'entry-1',
                    lorebookId: 'book-1',
                    title: 'Glass pact',
                    entryType: 'rule',
                    content: 'The pact binds the mirror court.',
                    keys: ['Pact'],
                    secondaryKeys: ['mirror court'],
                    selectiveLogic: 'and_any',
                    enabled: true,
                    constant: false,
                    caseSensitive: true,
                    matchWholeWords: true,
                    regex: false,
                    isSecret: false,
                    revealCondition: null,
                    insertionOrder: 0,
                    priority: 0,
                    insertionPosition: 'before_context',
                    tokenBudget: null,
                },
            ],
        })

        expect(previewLocally(lorebook, 'The Pact worries the mirror court.').results[0].status).toBe('activated')
        expect(previewLocally(lorebook, 'The pact worries the mirror court.').results[0].status).toBe('skipped')
        expect(previewLocally(lorebook, 'The Compact worries the mirror court.').results[0].status).toBe('skipped')
    })

    it('uses recursive scanning and token budgets in local preview', () => {
        const lorebook = book({
            settings: {
                scanDepth: 4,
                tokenBudget: 12,
                recursiveScanning: true,
                matchWholeWords: true,
                caseSensitive: false,
            },
            entries: [
                {
                    id: 'entry-1',
                    lorebookId: 'book-1',
                    title: 'First',
                    entryType: 'other',
                    content: 'The hidden token is moonwake.',
                    keys: ['glass market'],
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
                    priority: 0,
                    insertionPosition: 'before_context',
                    tokenBudget: null,
                },
                {
                    id: 'entry-2',
                    lorebookId: 'book-1',
                    title: 'Second',
                    entryType: 'other',
                    content: 'Moonwake opens the sealed archive.',
                    keys: ['moonwake'],
                    secondaryKeys: [],
                    selectiveLogic: 'any',
                    enabled: true,
                    constant: false,
                    caseSensitive: false,
                    matchWholeWords: true,
                    regex: false,
                    isSecret: false,
                    revealCondition: null,
                    insertionOrder: 1,
                    priority: 0,
                    insertionPosition: 'before_context',
                    tokenBudget: null,
                },
            ],
        })

        const preview = previewLocally(lorebook, 'I visit the glass market.')
        expect(preview.results.map((result) => result.status)).toEqual(['activated', 'skipped'])
        expect(preview.results[1].reason).toBe('Lorebook token budget exhausted.')
    })

    it('validates invalid regex keys', () => {
        const issues = validateLorebookLocally(book({
            entries: [
                {
                    id: 'entry-1',
                    lorebookId: 'book-1',
                    title: 'Broken pattern',
                    entryType: 'other',
                    content: 'content',
                    keys: ['[broken'],
                    secondaryKeys: [],
                    selectiveLogic: 'any',
                    enabled: true,
                    constant: false,
                    caseSensitive: false,
                    matchWholeWords: true,
                    regex: true,
                    isSecret: false,
                    revealCondition: null,
                    insertionOrder: 0,
                    priority: 0,
                    insertionPosition: 'before_context',
                    tokenBudget: null,
                },
            ],
        }))
        expect(issues.some((issue) => issue.code === 'entry_regex_invalid')).toBe(true)
    })

    it('does not warn that a resource-only lorebook is empty', () => {
        const issues = validateLorebookLocally(book({
            entries: [],
            metadata: { resources: [completedResource()] },
        }))

        expect(issues.some((issue) => issue.code === 'empty_book')).toBe(false)
    })

    it('counts shared resources as lorebook content without embedding them in save payloads', () => {
        const lorebook = book({
            entries: [],
            metadata: {
                resources: [completedResource({ id: 'embedded-resource' })],
                sharedResources: [completedResource({ id: 'shared-resource', title: 'Shared atlas' })],
                resourceIds: ['shared-resource'],
                ownerNote: 'keep me',
            },
        })

        const issues = validateLorebookLocally(lorebook)
        const payload = lorebookToApiPayload(lorebook)

        expect(issues.some((issue) => issue.code === 'empty_book')).toBe(false)
        expect(payload.metadata).toEqual({
            resources: [completedResource({ id: 'embedded-resource' })],
            ownerNote: 'keep me',
        })
    })

    it('includes completed resource snippets in local activation preview', () => {
        const preview = previewLocally(book({
            entries: [],
            metadata: { resources: [completedResource()] },
        }), 'I ask about the mirror oath.')

        const snippet = preview.results.find((result) => result.entryId.includes(':snippet:'))
        expect(snippet).toMatchObject({
            title: 'Mirror oath',
            status: 'activated',
            matchedKeys: ['mirror oath'],
        })
        expect(preview.promptPreview).toContain('Names spoken under the mirror oath')
    })

    it('includes completed shared resource snippets in local activation preview', () => {
        const preview = previewLocally(book({
            entries: [],
            metadata: { sharedResources: [completedResource({ id: 'shared-resource' })] },
        }), 'I ask about the mirror oath.')

        const snippet = preview.results.find((result) => result.entryId.includes(':snippet:'))
        expect(snippet).toMatchObject({
            title: 'Mirror oath',
            status: 'activated',
            matchedKeys: ['mirror oath'],
        })
    })

    it('keeps pending resources out of local activation preview until extraction completes', () => {
        const preview = previewLocally(book({
            entries: [],
            metadata: {
                resources: [
                    completedResource({
                        extractionStatus: 'pending',
                        extraction: null,
                    }),
                ],
            },
        }), 'I ask about the mirror oath.')

        expect(preview.results).toEqual([])
    })
})
