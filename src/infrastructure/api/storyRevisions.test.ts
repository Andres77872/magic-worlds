import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { isSceneRestoreWrite,verifySceneRevisionPage,verifySceneRevision,verifySceneRestoreAck } from './storyRevisionContract'
import { revisionHead,revisionPage,revisionSummary,sceneRevision,sceneRestoreAck,sceneRestoreWrite } from '@/test/fixtures/storyRevisions'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','history-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('loads small filtered summaries and only the selected checkpoint in the owned workspace',async()=>{
    fetchMock.mockResolvedValueOnce(response(revisionPage())).mockResolvedValueOnce(response(sceneRevision()))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    const query={before:3,source:'manual' as const,actor:'author' as const,fromDate:'2026-10-01',throughDate:'2026-10-16'}
    expect(await api.getStoryRevisions('story-1','scene-1',query)).toEqual(revisionPage())
    expect(await api.getStoryRevision('story-1','scene-1',2,'b'.repeat(64))).toEqual(sceneRevision())
    expect(String(fetchMock.mock.calls[0][0])).toContain('/scenes/scene-1/revisions?before=3&source=manual&actor=author&from_date=2026-10-01&through_date=2026-10-16')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/scenes/scene-1/revisions/2')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer history-token'})
})
it('requires ordered scoped summaries with no manuscript body and an exact pagination cursor',()=>{
    for(const page of [
        revisionPage({storyId:'foreign'}),revisionPage({sceneId:'foreign'}),revisionPage({head:revisionHead({sceneId:'foreign'})}),
        revisionPage({items:[revisionSummary(),revisionSummary()]}),revisionPage({items:[revisionSummary({revision:4})]}),
        revisionPage({items:[Object.assign(revisionSummary(),{body:'unexpected private prose'})]}),revisionPage({nextBefore:2}),
        revisionPage({items:[revisionSummary({parentRevision:2})]}),revisionPage({items:[revisionSummary({contentHash:'broken'})]}),
    ])expect(verifySceneRevisionPage(page,'story-1','scene-1')).toBe(false)
    const rows=Array.from({length:50},(_,index)=>revisionSummary({revision:100-index,parentRevision:99-index}))
    expect(verifySceneRevisionPage(revisionPage({head:revisionHead({revision:100}),items:rows,nextBefore:51}),'story-1','scene-1')).toBe(true)
    expect(verifySceneRevisionPage(revisionPage({head:revisionHead({revision:100}),items:rows,nextBefore:50}),'story-1','scene-1')).toBe(false)
})
it('rejects filter drift, while preserving unsupported checkpoints in readable metadata pages',()=>{
    const page=revisionPage()
    for(const query of [{before:2},{source:'ai' as const},{actor:'system' as const},{fromDate:'2026-10-17'},{throughDate:'2026-10-15'}])expect(verifySceneRevisionPage(page,'story-1','scene-1',query)).toBe(false)
    expect(verifySceneRevisionPage(revisionPage({items:[revisionSummary({schemaVersion:2})]}),'story-1','scene-1')).toBe(true)
    expect(verifySceneRevisionPage(revisionPage({head:revisionHead({readOnly:true})}),'story-1','scene-1')).toBe(true)
})
it('rejects foreign, future or mismatched checkpoint details and inconsistent derived text',async()=>{
    const value=sceneRevision()
    for(const bad of [{...value,storyId:'foreign'},{...value,sceneId:'foreign'},{...value,revision:1},{...value,contentHash:'c'.repeat(64)},{...value,schemaVersion:2},{...value,body:'changed projection'},{...value,plainText:'changed projection'}])expect(verifySceneRevision(bad,'story-1','scene-1',2,'b'.repeat(64))).toBe(false)
    fetchMock.mockResolvedValue(response({...value,sceneId:'foreign'}))
    await expect(apiService.getStoryRevision('story-1','scene-1',2)).rejects.toMatchObject({code:'story_contract'})
})
it('binds restore and receipt-only recovery to both reviewed hashes and the exact immutable request',async()=>{
    const write=sceneRestoreWrite(),ack=sceneRestoreAck(write)
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(null))
    expect(await apiService.restoreStoryRevision('story-1','scene-1',2,write)).toEqual(ack)
    expect(await apiService.getStoryRevisionRestoreResult('story-1','scene-1',2,write)).toEqual(ack)
    expect(await apiService.getStoryRevisionRestoreResult('story-1','scene-1',2,write)).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(write)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/revisions/2/restore-requests/restore-scene-1?expectedRevision=3&expectedContentHash='+write.expectedContentHash+'&sourceContentHash='+write.sourceContentHash)
    expect(fetchMock.mock.calls[1][1].method??'GET').toBe('GET')
    for(const bad of [{...ack,storyId:'foreign'},{...ack,sceneId:'foreign'},{...ack,sourceRevision:1},{...ack,revision:5},{...ack,contentHash:'c'.repeat(64)},{...ack,write:{...write,requestId:'another'}},{...ack,document:{}}])expect(verifySceneRestoreAck(bad,'story-1','scene-1',2,write)).toBe(false)
})
it('retains uncertain mismatched acknowledgements as contract failures',async()=>{
    fetchMock.mockImplementation(async()=>response({...sceneRestoreAck(),revision:6}))
    await expect(apiService.restoreStoryRevision('story-1','scene-1',2,sceneRestoreWrite())).rejects.toMatchObject({status:502,code:'story_contract'})
    await expect(apiService.getStoryRevisionRestoreResult('story-1','scene-1',2,sceneRestoreWrite())).rejects.toMatchObject({code:'story_contract'})
    expect(isSceneRestoreWrite({...sceneRestoreWrite(),expectedRevision:true})).toBe(false)
    expect(isSceneRestoreWrite({...sceneRestoreWrite(),document:{}})).toBe(false)
})
it('does not contact the backend when novels are disabled',async()=>{
    setTestFeatureFlags({ novels: false })
    for(const call of [()=>apiService.getStoryRevisions('story-1','scene-1'),()=>apiService.getStoryRevision('story-1','scene-1',2),()=>apiService.restoreStoryRevision('story-1','scene-1',2,sceneRestoreWrite()),()=>apiService.getStoryRevisionRestoreResult('story-1','scene-1',2,sceneRestoreWrite())])await expect(call()).rejects.toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
})
const paths=['page','detail','receipt'].map((name)=>'/tmp/novel-scene-history-smoke-'+name+'.json')
it.skipIf(paths.some((path)=>!existsSync(path)))('accepts actual isolated MySQL summary, canonical checkpoint and receipt contracts',()=>{
    const [page,detail,{storyId,sceneId,revision,write,ack}]=paths.map((path)=>JSON.parse(readFileSync(path,'utf-8')))
    expect(verifySceneRevisionPage(page,page.storyId,page.sceneId)).toBe(true)
    expect(verifySceneRevision(detail,detail.storyId,detail.sceneId,detail.revision)).toBe(true)
    expect(verifySceneRestoreAck(ack,storyId,sceneId,revision,write)).toBe(true)
})
