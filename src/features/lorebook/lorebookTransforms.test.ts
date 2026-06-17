import { describe, expect, it } from 'vitest'
import type { Lorebook } from '@/shared'
import { entryToApiPayload, previewLocally, validateLorebookLocally } from './lorebookTransforms'

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
})
