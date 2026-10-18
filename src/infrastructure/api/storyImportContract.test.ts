import { describe, expect, it } from 'vitest'
import { importManifest, importRecord, IMPORT_HASH } from '@/test/fixtures/storyImport'
import { isStoryImportWrite, storyImportFormat, verifyStoryImportAcknowledgement, verifyStoryImportManifest, verifyStoryImportRecord } from './storyImportContract'

const options = { chapterLevel: 'auto', splitScenes: true } as const
const file = { size: 42, sha256: IMPORT_HASH }

describe('story import contract', () => {
    it('accepts a preview only for the same bytes, the same options and a consistent outline', () => {
        expect(verifyStoryImportManifest(importManifest(), file, options)).toBe(true)
        expect(verifyStoryImportManifest(importManifest(), { ...file, size: 43 }, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(), { ...file, sha256: 'f'.repeat(64) }, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(), file, { ...options, splitScenes: false })).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'X', part: 1, role: null, scenes: [{ title: 'Scene 1', words: 1, excerpt: '' }] }] }), file, options)).toBe(false)
        // A front- or back-matter chapter has a known role and sits outside any part; every chapter states its role.
        const scene = { title: 'Scene 1', words: 1, excerpt: '' }
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'Dedication', part: null, role: 'dedication', scenes: [scene] }] }), file, options)).toBe(true)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'Thanks', part: 0, role: 'acknowledgments', scenes: [scene] }] }), file, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'Prologue', part: null, role: 'prologue' as never, scenes: [scene] }] }), file, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'X', part: null, scenes: [scene] } as never] }), file, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [] }), file, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { losses: [{ code: 'macros_run' as never, count: 1 }] }), file, options)).toBe(false)
        expect(verifyStoryImportManifest({ ...importManifest(), extra: true }, file, options)).toBe(false)
        expect(verifyStoryImportManifest(importManifest(options, { format: 'epub', losses: [{ code: 'ruby_dropped', count: 2 }] }), file, options)).toBe(true)
        expect(verifyStoryImportManifest(importManifest(options, { format: 'pdf' as never }), file, options)).toBe(false)
        // Lengths count characters, as the server does: 160 emoji are a valid excerpt.
        const excerpt = '🌒'.repeat(160)
        expect(verifyStoryImportManifest(importManifest(options, { chapters: [{ title: 'X', part: null, role: null, scenes: [{ title: 'Scene 1', words: 1, excerpt }] }] }), file, options)).toBe(true)
    })

    it('checks writes, receipts and import records exactly', () => {
        const write = { requestId: 'novel-import-1', title: 'Gull Point', sourceHash: IMPORT_HASH, importVersion: 'b'.repeat(64), options }
        expect(isStoryImportWrite(write)).toBe(true)
        expect(isStoryImportWrite({ ...write, title: ' Gull Point' })).toBe(false)
        expect(isStoryImportWrite({ ...write, options: { chapterLevel: 7, splitScenes: true } })).toBe(false)
        const ack = { kind: 'novel_import', requestId: write.requestId, storyId: '0a1b2c3d-0000-5000-8000-000000000001', write }
        expect(verifyStoryImportAcknowledgement(ack, write)).toBe(true)
        expect(verifyStoryImportAcknowledgement({ ...ack, kind: 'novel_create' }, write)).toBe(false)
        expect(verifyStoryImportAcknowledgement({ ...ack, write: { ...write, title: 'Other' } }, write)).toBe(false)
        const record = importRecord()
        expect(verifyStoryImportRecord(record, record.storyId)).toBe(true)
        expect(verifyStoryImportRecord(record, 'other')).toBe(false)
        expect(verifyStoryImportRecord({ ...record, bytes: 0 }, record.storyId)).toBe(false)
    })

    it('names the format of each supported file extension', () => {
        expect(['a.md', 'b.MARKDOWN', 'c.txt', 'd.text', 'e.Docx', 'f.EPUB', 'g.odt', 'h.rtf'].map(storyImportFormat))
            .toEqual(['markdown', 'markdown', 'text', 'text', 'docx', 'epub', 'odt', 'rtf'])
        expect(['a.doc', 'b.pdf', 'c.ods', 'd.fodt', 'noextension'].map(storyImportFormat)).toEqual([null, null, null, null, null])
    })
})
