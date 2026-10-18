import { describe, expect, it } from 'vitest'
import type { StoryCardRef, StoryCodexWrite } from '@/shared'
import { verifyStoryCodexAcknowledgement, verifyStoryCodexLibraryDraft, verifyStoryCodexLibraryEntry, verifyStoryCodexLibraryReview, verifyStoryCodexLibraryVersions } from './storyContract'

const ref: StoryCardRef = { id: 'ref-1', storyId: 'story-1', chapterId: null, sceneId: null, removedAt: null, kind: 'character', cardId: 'card-1',
    source: 'manual', enabled: true, precedence: 0,
    snapshot: { id: 'card-1', name: 'Mira', description: 'A ranger', story_card_kind: 'character', source_card_id: 'card-1', source_card_version_id: 'v3', source_card_version_number: 3 } }
const current = { ...ref.snapshot, description: 'A ranger of the north road', source_card_version_id: 'v5', source_card_version_number: 5 }

describe('Codex library contracts', () => {
    it('accepts exact library version and library change notices only', () => {
        const state = 'b'.repeat(64)
        expect(verifyStoryCodexLibraryVersions({ versions: [{ refId: 'ref-1', latestVersionNumber: 5 }], changed: [] })).toBe(true)
        expect(verifyStoryCodexLibraryVersions({ versions: [], changed: [{ refId: 'ref-2', sourceVersionId: state }] })).toBe(true)
        for (const value of [{ versions: [{ refId: 'ref-1', latestVersionNumber: -1 }], changed: [] }, { versions: [{ refId: 'ref-1', latestVersionNumber: 5, extra: 1 }], changed: [] },
            { versions: [{ refId: 'ref-1', latestVersionNumber: 5 }, { refId: 'ref-1', latestVersionNumber: 6 }], changed: [] }, { versions: [], changed: [], more: true },
            { versions: [] }, { versions: [], changed: [{ refId: 'ref-2', sourceVersionId: 'v5' }] },
            { versions: [{ refId: 'ref-1', latestVersionNumber: 5 }], changed: [{ refId: 'ref-1', sourceVersionId: state }] }, null])
            expect(verifyStoryCodexLibraryVersions(value)).toBe(false)
    })

    it('accepts a review of the same library card pinned to a saved version', () => {
        expect(verifyStoryCodexLibraryReview({ refId: 'ref-1', current, base: { name: 'Mira', description: 'A ranger' }, sourceVersionId: 'v5' }, ref)).toBe(true)
        expect(verifyStoryCodexLibraryReview({ refId: 'ref-1', current, base: null, sourceVersionId: 'v5' }, ref)).toBe(true)
        for (const value of [
            { refId: 'ref-2', current, base: null, sourceVersionId: 'v5' },
            { refId: 'ref-1', current: { ...current, id: 'card-2', source_card_id: 'card-2' }, base: null, sourceVersionId: 'v5' },
            { refId: 'ref-1', current: { ...current, source_card_version_id: null }, base: null, sourceVersionId: 'v5' },
            { refId: 'ref-1', current: { ...current, source_card_version_number: 0 }, base: null, sourceVersionId: 'v5' },
            { refId: 'ref-1', current, base: { source_card_version_id: 'forged' }, sourceVersionId: 'v5' },
            { refId: 'ref-1', current, base: null, sourceVersionId: 'v4' },
            { refId: 'ref-1', current, base: null },
            { refId: 'ref-1', current, base: null, sourceVersionId: 'v5', extra: true },
        ]) expect(verifyStoryCodexLibraryReview(value, ref)).toBe(false)
    })

    it('accepts a review of the same lorebook entry named by its library state', () => {
        const state = 'b'.repeat(64)
        const entry: StoryCardRef = { ...ref, kind: 'lorebook_entry', cardId: 'entry-1', snapshot: { id: 'entry-1', name: 'The Tide Bell', description: 'Rings once.',
            story_card_kind: 'lorebook_entry', source_lorebook_id: 'book-1', source_base: { state_id: 'a'.repeat(64), name: 'The Tide Bell', description: 'Rings once.' } } }
        const now = { id: 'entry-1', name: 'The Drowned Bell', description: 'Rings twice.', story_card_kind: 'lorebook_entry', source_lorebook_id: 'book-1' }
        expect(verifyStoryCodexLibraryReview({ refId: 'ref-1', current: now, base: { name: 'The Tide Bell', description: 'Rings once.' }, sourceVersionId: state }, entry)).toBe(true)
        for (const value of [
            { refId: 'ref-1', current: now, base: null, sourceVersionId: 'v5' },
            { refId: 'ref-1', current: { ...now, source_lorebook_id: 'book-2' }, base: null, sourceVersionId: state },
            { refId: 'ref-1', current: { ...now, source_card_version_id: 'v1' }, base: null, sourceVersionId: state },
            { refId: 'ref-1', current: { ...now, id: 'entry-2' }, base: null, sourceVersionId: state },
        ]) expect(verifyStoryCodexLibraryReview(value, entry)).toBe(false)
        const write: StoryCodexWrite = { requestId: 'refresh-2', expectedContextRevision: 4, operation: { op: 'refresh', id: 'ref-1', sourceVersionId: state, take: [] } }
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...entry, snapshot: { ...entry.snapshot, source_base: { state_id: state, name: 'The Drowned Bell' } } }] }, 'story-1', write)).toBe(true)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [entry] }, 'story-1', write)).toBe(false)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...entry, snapshot: { ...entry.snapshot, source_base: { state_id: state, secret: 'x' } } }] }, 'story-1', write)).toBe(false)
    })

    it('acknowledges a refresh only when the copy names the reviewed version', () => {
        const write: StoryCodexWrite = { requestId: 'refresh-1', expectedContextRevision: 4, operation: { op: 'refresh', id: 'ref-1', sourceVersionId: 'v5', take: ['description'] } }
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...ref, snapshot: current }] }, 'story-1', write)).toBe(true)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [ref] }, 'story-1', write)).toBe(false)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...ref, snapshot: current, removedAt: '2026-10-17T00:00:00Z' }] }, 'story-1', write)).toBe(false)
    })

    it('accepts a library draft basis for the same entry with a content stamp and the details its kind has', () => {
        const value = { refId: 'ref-1', basis: 'published', name: 'Mira', alias: null, race: 'Elf', description: 'A ranger', stamp: 'a'.repeat(64), versionNumber: 3 }
        expect(verifyStoryCodexLibraryDraft(value, ref)).toBe(true)
        expect(verifyStoryCodexLibraryDraft({ ...value, alias: 'The Ranger', race: null }, ref)).toBe(true)
        const setting = { refId: 'ref-1', basis: 'published', name: 'Mira', alias: null, description: 'A ranger', stamp: 'a'.repeat(64), versionNumber: 3 }
        expect(verifyStoryCodexLibraryDraft({ ...setting, type: 'Harbor town' }, { id: 'ref-1', kind: 'world' })).toBe(true)
        for (const bad of [{ ...value, refId: 'ref-2' }, { ...value, basis: 'body' }, { ...value, stamp: 'xyz' }, { ...value, versionNumber: -1 }, { ...value, extra: 1 },
            { ...value, name: 7 }, { ...value, alias: 7 }, setting, { ...setting, type: 'Harbor town' }])
            expect(verifyStoryCodexLibraryDraft(bad, ref)).toBe(false)
    })

    it('acknowledges a discovery only with a copy of the reviewed details pinned to its new library source', () => {
        const fields = { name: 'Odile', description: 'The ferry pilot.' }
        const write: StoryCodexWrite = { requestId: 'discover-1', expectedContextRevision: 4, operation: { op: 'discover', destination: 'character', fields } }
        const made: StoryCardRef = { ...ref, id: 'ref-9', cardId: 'card-9', snapshot: { id: 'card-9', ...fields, story_card_kind: 'character', source_card_id: 'card-9', source_card_version_id: 'v1', source_card_version_number: 1 } }
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [ref, made] }, 'story-1', write)).toBe(true)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [ref] }, 'story-1', write)).toBe(false)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...made, snapshot: { ...made.snapshot, description: 'Other.' } }] }, 'story-1', write)).toBe(false)
        const lore: StoryCodexWrite = { requestId: 'discover-2', expectedContextRevision: 4, operation: { op: 'discover', destination: 'lorebook_entry', lorebookId: 'book-1', fields: { ...fields, keys: ['Odile'] } } }
        const entry: StoryCardRef = { ...ref, id: 'ref-10', kind: 'lorebook_entry', cardId: 'entry-9', snapshot: { id: 'entry-9', ...fields, story_card_kind: 'lorebook_entry', source_lorebook_id: 'book-1' } }
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [entry] }, 'story-1', lore)).toBe(true)
        expect(verifyStoryCodexAcknowledgement({ contextRevision: 5, refs: [{ ...entry, snapshot: { ...entry.snapshot, source_lorebook_id: 'book-2' } }] }, 'story-1', lore)).toBe(false)
    })

    it('accepts the library lorebook entry a Codex lorebook entry was copied from, with a content stamp', () => {
        const entry: StoryCardRef = { ...ref, id: 'ref-2', kind: 'lorebook_entry', cardId: 'entry-1',
            snapshot: { id: 'entry-1', name: 'The Tide Bell', description: 'A brass bell.', story_card_kind: 'lorebook_entry', source_lorebook_id: 'book-1' } }
        const value = { refId: 'ref-2', lorebookId: 'book-1', entryId: 'entry-1', title: 'The Tide Bell', keys: ['bell', 'tide'], content: 'A brass bell.', stamp: 'a'.repeat(64) }
        expect(verifyStoryCodexLibraryEntry(value, entry)).toBe(true)
        expect(verifyStoryCodexLibraryEntry({ ...value, content: '' }, entry)).toBe(true)
        for (const bad of [{ ...value, refId: 'ref-1' }, { ...value, lorebookId: 'book-2' }, { ...value, entryId: 'entry-2' }, { ...value, stamp: 'xyz' },
            { ...value, content: 7 }, { ...value, extra: 1 }, { ...value, keys: 'bell' }, { ...value, keys: [7] }])
            expect(verifyStoryCodexLibraryEntry(bad, entry)).toBe(false)
    })
})
