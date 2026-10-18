import { manuscript } from '@/test/fixtures/story'
import { documentText } from '@/shared/storyDocument'
import { beforeEach, describe, expect, it } from 'vitest'
import { draftJournalKey, readCheckpoint, retireRecovery, writeCheckpoint, type DraftCheckpoint } from './draftJournal'
const checkpoint = (body: string): DraftCheckpoint => ({ schema: 2, document:manuscript(body), title: 'Chapter One', baseRevision: 1, baseMetadataRevision: 1, sequence: 1, pending: null })

it('never downgrades an invalid authored acceptance into a normal pending save',()=>{
    const key='authored-pending::writer:one',variant={id:'author-version',variantHash:'a'.repeat(64)}
    const pending={generationId:'model-parent',variant,write:{requestId:'apply-version',expectedRevision:1,document:manuscript('Exact reviewed version.'),anchorEdits:[]}}
    writeCheckpoint(key,{...checkpoint('Later private writing.'),pending})
    expect(readCheckpoint(key)?.pending).toEqual(pending)
    for(const changed of [{...pending,generationId:undefined},{...pending,variant:{...variant,variantHash:'corrupt'}},
        {...pending,variant:{...variant,id:'model-parent'}},{...pending,variant:{...variant,apply:true}}]){
        localStorage.setItem(key,JSON.stringify({...checkpoint('Readable writing.'),pending:changed}))
        const recovered=readCheckpoint(key)!
        expect(recovered.document).toEqual(manuscript('Readable writing.'))
        expect(recovered.pendingInvalid).toBe(true);expect(recovered.pending).toBeNull()
    }
})
beforeEach(() => localStorage.clear())
describe('scoped manuscript checkpoints', () => {
    it('retains a rejected generation application independently of later unsent prose',()=>{
        const key=draftJournalKey('author','workspace','novel','scene')!
        const applicationRejection={reason:'sources_changed' as const,generationId:'generation-1',write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Reviewed proposed writing')}}
        writeCheckpoint(key,{...checkpoint('Later author writing'),applicationRejection})
        const saved=readCheckpoint(key)!
        expect(saved.applicationRejection).toEqual(applicationRejection)
        expect(documentText(saved.document)).toBe('Later author writing')
        writeCheckpoint(key,{...checkpoint('Later author writing'),applicationRejection:{...applicationRejection,generationId:'another-generation'}})
        retireRecovery(saved)
        expect(readCheckpoint(key)?.applicationRejection?.generationId).toBe('another-generation')
    })
    it('keeps readable writing but blocks a corrupt rejected application from replay',()=>{
        const key=draftJournalKey('author','workspace','novel','scene')!
        localStorage.setItem(key,JSON.stringify({...checkpoint('Readable prose'),applicationRejection:{reason:'sources_changed',generationId:'generation-1',write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Proposal')},credentials:'unowned'}}))
        const saved=readCheckpoint(key)!
        expect(saved.pendingInvalid).toBe(true)
        expect(saved.applicationRejection).toBeUndefined()
        expect(documentText(saved.document)).toBe('Readable prose')
    })
    it('does not replay an unsupported request while retaining its readable prose and original record', () => {
        const key = draftJournalKey('author', 'workspace', 'novel', 'scene')!
        const raw = JSON.stringify({ ...checkpoint('Readable private prose'), pending: { write: { requestId: 'bad / request', expectedRevision: 1, document: manuscript('Unverified request') } }, writtenAt: 10 })
        localStorage.setItem(key, raw)
        const recovered = readCheckpoint(key)!
        expect(recovered.pendingInvalid).toBe(true)
        expect(recovered.pending).toBeNull()
        expect(documentText(recovered.document)).toBe('Readable private prose')
        retireRecovery(recovered)
        expect(localStorage.getItem(key)).toBe(raw)
    })

    it('keeps the exact valid original prefix while newer checkpoint prose remains unsent', () => {
        const key = draftJournalKey('author', 'workspace', 'novel', 'scene')!
        const pending = { write: { requestId: 'original-prefix', expectedRevision: 1, document: manuscript('First prefix') } }
        writeCheckpoint(key, { ...checkpoint('Later unsent prose'), pending })
        const recovered = readCheckpoint(key)!
        expect(recovered.pending).toEqual(pending)
        expect(recovered.pendingInvalid).toBeUndefined()
        expect(documentText(recovered.document)).toBe('Later unsent prose')
    })

    it('does not let a malformed preferred writer hide another valid scoped draft', () => {
        const own = draftJournalKey('author', 'workspace', 'novel', 'scene', 'own')!
        const other = draftJournalKey('author', 'workspace', 'novel', 'scene', 'other')!
        localStorage.setItem(own, '{broken')
        writeCheckpoint(other, checkpoint('Another recoverable writer'))
        expect(documentText(readCheckpoint(own)!.document)).toBe('Another recoverable writer')
        expect(localStorage.getItem(own)).toBe('{broken')
    })

    it('does not retire a recovery record whose acknowledged base changed', () => {
        const key = draftJournalKey('author', 'workspace', 'novel', 'scene')!
        writeCheckpoint(key, checkpoint('Same prose'))
        const recovered = readCheckpoint(key)
        writeCheckpoint(key, { ...checkpoint('Same prose'), baseRevision: 2 })
        retireRecovery(recovered)
        expect(readCheckpoint(key)!.baseRevision).toBe(2)
    })
    it('isolates simultaneous writers and can discover a checkpoint after reload', () => {
        const first = draftJournalKey('author', 'workspace', 'novel', 'scene', 'tab-one')!
        const second = draftJournalKey('author', 'workspace', 'novel', 'scene', 'tab-two')!
        writeCheckpoint(first, checkpoint('First tab draft'))
        writeCheckpoint(second, checkpoint('Second tab draft'))
        expect(documentText(readCheckpoint(first)!.document)).toBe('First tab draft')
        expect(documentText(readCheckpoint(second)!.document)).toBe('Second tab draft')
        const reopened = draftJournalKey('author', 'workspace', 'novel', 'scene', 'after-reload')!
        expect(readCheckpoint(reopened)).not.toBeNull()
        expect(readCheckpoint(draftJournalKey('another-author', 'workspace', 'novel', 'scene'))).toBeNull()
    })
    it('never removes newer typing when retiring a recovered snapshot', () => {
        const key = draftJournalKey('author', 'workspace', 'novel', 'scene')!
        writeCheckpoint(key, checkpoint('Original'))
        const recovered = readCheckpoint(key)
        writeCheckpoint(key, { ...checkpoint('Newer typing'), sequence: 2 })
        retireRecovery(recovered)
        expect(documentText(readCheckpoint(key)!.document)).toBe('Newer typing')
    })
})
