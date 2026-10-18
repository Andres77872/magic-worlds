import { beforeEach, describe, expect, it, vi } from 'vitest'
import { manuscript } from '@/test/fixtures/story'
import { readRetainedSceneDrafts, retainSceneDraft, retainedSceneDraftPrefix } from './retainedSceneDrafts'

const input = () => ({ title: 'The sealed letter', document: manuscript('Device prose 🦋', 'retained-block'), baseRevision: 3, baseMetadataRevision: 2 })
const prefix = () => retainedSceneDraftPrefix('author', 'workspace', 'novel', 'scene')!
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('retained device alternatives', () => {
    it('retains the failed authored operation independently from later device prose',()=>{
        const applicationRejection={reason:'candidate_changed' as const,generationId:'generation-1',
            variant:{id:'authored-version',variantHash:'a'.repeat(64)},write:{requestId:'accept-1',expectedRevision:3,document:manuscript('Reviewed authored prose.')}}
        const saved=retainSceneDraft(prefix(),{...input(),applicationRejection})!
        expect(saved.applicationRejection).toEqual(applicationRejection)
        expect(readRetainedSceneDrafts(prefix()).items[0].applicationRejection?.variant).toEqual(applicationRejection.variant)
        expect(readRetainedSceneDrafts(prefix()).items[0].document).toEqual(input().document)
        expect(retainSceneDraft(prefix(),{...input(),applicationRejection:{...applicationRejection,variant:{...applicationRejection.variant,variantHash:'corrupt'}}})).toBeNull()
    })
    it('keeps separate immutable copies outside the active autosave journal', () => {
        const draft = input(), first = retainSceneDraft(prefix(), draft)!, second = retainSceneDraft(prefix(), input())!
        expect(first.storageKey).not.toBe(second.storageKey)
        draft.document.content.content![0].content![0].text = 'Later typing'
        const read = readRetainedSceneDrafts(prefix())
        expect(read.unavailable).toBe(false)
        expect(read.items).toHaveLength(2)
        expect(read.items.every((item) => item.document.content.content![0].content![0].text === 'Device prose 🦋')).toBe(true)
        expect(read.items.every((item) => !('pending' in item))).toBe(true)
    })

    it('isolates author, workspace, novel and scene and preserves unknown or unrelated records', () => {
        retainSceneDraft(prefix(), input())
        const raw = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])))
        for (const parts of [['other', 'workspace', 'novel', 'scene'], ['author', 'other', 'novel', 'scene'], ['author', 'workspace', 'other', 'scene'], ['author', 'workspace', 'novel', 'other']]) {
            expect(readRetainedSceneDrafts(retainedSceneDraftPrefix(...parts as [string, string, string, string])).items).toEqual([])
        }
        localStorage.setItem(prefix() + 'malformed', '{not valid JSON')
        localStorage.setItem('unrelated-media-without-file', 'valid record')
        expect(readRetainedSceneDrafts(prefix()).items).toHaveLength(1)
        expect(localStorage.getItem(prefix() + 'malformed')).toBe('{not valid JSON')
        expect(localStorage.getItem('unrelated-media-without-file')).toBe('valid record')
        expect(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter((key) => !key.endsWith('malformed') && key !== 'unrelated-media-without-file').map((key) => [key, localStorage.getItem(key)])))).toBe(raw)
    })

    it('reports quota/policy failure without evicting an existing draft or inventing a retained copy', () => {
        const saved = retainSceneDraft(prefix(), input())!
        const original = localStorage.getItem(saved.storageKey)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
        expect(retainSceneDraft(prefix(), input())).toBeNull()
        expect(localStorage.getItem(saved.storageKey)).toBe(original)
        expect(readRetainedSceneDrafts(prefix()).items).toHaveLength(1)
    })

    it('rejects unsupported documents and reads valid copies even alongside an unsupported schema', () => {
        expect(retainSceneDraft(null, input())).toBeNull()
        expect(retainSceneDraft(prefix(), { ...input(), baseRevision: 0 })).toBeNull()
        const invalid = input(); invalid.document.content.content![0].type = 'unsupported'
        expect(retainSceneDraft(prefix(), invalid)).toBeNull()
        const saved = retainSceneDraft(prefix(), input())!
        localStorage.setItem(prefix() + 'future', JSON.stringify({ ...saved, schema: 9, storageKey: undefined }))
        expect(readRetainedSceneDrafts(prefix()).items.map((item) => item.storageKey)).toEqual([saved.storageKey])
    })

    it('surfaces unavailable browser storage rather than claiming an empty saved-copy list', () => {
        vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => { throw new Error('Storage denied') })
        expect(readRetainedSceneDrafts(prefix())).toEqual({ items: [], unavailable: true })
    })
})
