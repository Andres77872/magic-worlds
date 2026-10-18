import { afterEach, expect, it, vi } from 'vitest'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { reconciliationSource } from '../hooks/useReconciliationProgress'
import { reconciliationJournal, reconciliationKey, reconciliationSceneScope, validReconciliationCheckpoint, validReconciliationSource, type ReconciliationCheckpoint } from './reconciliationJournal'

const scope = { apiOrigin: 'https://writing.example', userHash: 'author', workspaceId: 'desk' }
const source = reconciliationSource({ id: 'review', ownerKey: 'owner', sequence: 2, deviceTitle: 'The letter',
    baseDocument: manuscript('The letter waited.', 'letter'), deviceDocument: manuscript('A local letter.', 'letter'),
    account: storyScene({ document: manuscript('The account letter.', 'letter') }) })
function checkpoint(): ReconciliationCheckpoint {
    return { schema: 1, key: reconciliationKey(scope, 'writer'), sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId),
        source, value: { choices: { letter: 'device' }, order: 'device', title: 'device' }, sequence: 1, writtenAt: 1 }
}
afterEach(() => vi.unstubAllGlobals())
it('keeps rejected-application identity in saved comparison sources and rejects added authority',()=>{
    const applicationRejection={reason:'sources_changed' as const,generationId:'generation-1',write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Proposed text.')}}
    const value={...source,applicationRejection}
    expect(validReconciliationSource(value)).toBe(true)
    expect(validReconciliationSource({...value,applicationRejection:{...applicationRejection,credentials:'never-store'}})).toBe(false)
    const review={id:'failed-application',ownerKey:'owner',sequence:1,deviceTitle:source.deviceTitle,deviceDocument:source.device,baseDocument:source.base,
        account:storyScene({document:source.account}),applicationRejection}
    expect(reconciliationSource(review).applicationRejection).toEqual(applicationRejection)
})
it('carries the exact authored version through durable comparison and rejects a corrupt version reference',()=>{
    const applicationRejection={reason:'candidate_changed' as const,generationId:'generation-1',
        variant:{id:'author-version',variantHash:'a'.repeat(64)},write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Authored version.')}}
    expect(validReconciliationSource({...source,applicationRejection})).toBe(true)
    const review={id:'authored-rejection',ownerKey:'owner',sequence:1,deviceTitle:source.deviceTitle,deviceDocument:source.device,baseDocument:source.base,
        account:storyScene({document:source.account}),applicationRejection}
    expect(reconciliationSource(review).applicationRejection?.variant).toEqual(applicationRejection.variant)
    expect(validReconciliationSource({...source,applicationRejection:{...applicationRejection,variant:{...applicationRejection.variant,variantHash:'corrupt'}}})).toBe(false)
})
it('binds a review to canonical source documents, exact saved heads and a stable account/workspace scope', () => {
    const value = checkpoint()
    expect(validReconciliationSource(source)).toBe(true)
    expect(validReconciliationCheckpoint(value, value.sceneScope, value.key.slice(0, value.key.lastIndexOf('::') + 2))).toBe(true)
    expect(validReconciliationSource({ ...source, accountContentHash: 'not-a-hash' })).toBe(false)
    expect(validReconciliationSource({ ...source, device: { schemaVersion: 9, content: {} } })).toBe(false)
    expect(validReconciliationCheckpoint(value, reconciliationSceneScope({ ...scope, workspaceId: 'other' }, source.storyId, source.sceneId), value.key)).toBe(false)
    expect(validReconciliationCheckpoint({ ...value, value: { ...value.value, choices: { letter: 'automatic' } } }, value.sceneScope, value.key)).toBe(false)
    expect(value).not.toHaveProperty('requestId')
    expect(value).not.toHaveProperty('token')
})
it('reports blocked durable storage without changing any existing browser record', async () => {
    const raw = 'Existing draft must stay'; localStorage.setItem('unrelated-draft', raw)
    vi.stubGlobal('indexedDB', { open: vi.fn(() => { throw new Error('Policy') }) })
    expect(await reconciliationJournal.load(scope, source)).toMatchObject({ checkpoint: null, unavailable: true })
    expect(await reconciliationJournal.save(scope, checkpoint())).toBe('unavailable')
    expect(localStorage.getItem('unrelated-draft')).toBe(raw)
})
