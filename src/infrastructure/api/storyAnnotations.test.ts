import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { isAnnotationAnchor,isAnnotationSelection,isAnnotationWrite,verifyAnnotation,verifyAnnotationPage,verifyAnnotationAck,verifyAnnotationCopyPreview } from './storyAnnotationContract'
import { noteAck,noteAnchor,notePage,noteSummary,noteWrite,personalNote } from '@/test/fixtures/storyAnnotations'
const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','annotation-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('reads small filtered note summaries and one selected owned note in the requested workspace',async()=>{
    fetchMock.mockResolvedValueOnce(response(notePage())).mockResolvedValueOnce(response(personalNote()))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.getStoryAnnotations('story-1',{sceneId:'scene-1',state:'open',anchorState:'attached',q:'Mira'})).toEqual(notePage())
    expect(await api.getStoryAnnotation('story-1','note-1')).toEqual(personalNote())
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stories/story-1/annotations?scene_id=scene-1&state=open&anchor_state=attached&q=Mira')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer annotation-token'})
})
it('reads only scoped comment counts for copy review and rejects duplicate, negative or foreign summaries',async()=>{
    const value={storyId:'story-1',annotationRevision:8,scenes:[{sceneId:'scene-1',open:2,resolved:1,trashed:1}]}
    fetchMock.mockResolvedValueOnce(response(value))
    expect(await apiService.getStoryAnnotationCopyPreview('story-1')).toEqual(value)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stories/story-1/annotation-copy-preview')
    expect(verifyAnnotationCopyPreview({...value,scenes:[...value.scenes,...value.scenes]},'story-1')).toBe(false)
    expect(verifyAnnotationCopyPreview({...value,scenes:[{...value.scenes[0],open:-1}]},'story-1')).toBe(false)
    expect(verifyAnnotationCopyPreview(value,'foreign')).toBe(false)
    expect(verifyAnnotationCopyPreview({...value,scenes:[{...value.scenes[0],body:'Private full note'}]},'story-1')).toBe(false)
})
it('rejects malformed source points, selections and operations before trusting durable writes',()=>{
    expect(isAnnotationAnchor(noteAnchor())).toBe(true)
    expect(isAnnotationAnchor({...noteAnchor(),schemaVersion:2})).toBe(false)
    expect(isAnnotationAnchor({...noteAnchor(),start:{nodeId:'p1',offset:true}})).toBe(false)
    const write=noteWrite();expect(isAnnotationWrite(write)).toBe(true)
    if(write.operation.op!=='create')throw new Error('Fixture')
    expect(isAnnotationSelection({...write.operation.anchor,endOffset:0})).toBe(false)
    expect(isAnnotationWrite({...write,operation:{...write.operation,body:'  '}})).toBe(false)
    expect(isAnnotationWrite({...write,operation:{...write.operation,author:'someone-else'}})).toBe(false)
    expect(isAnnotationWrite({...write,operation:{op:'edit',id:'note-1',expectedRevision:true,body:'Wrong counter'}})).toBe(false)
})
it('rejects foreign notes, mismatched live anchors and inconsistent orphan states',async()=>{
    const note=personalNote()
    for(const value of [{...note,storyId:'foreign'},{...note,id:'foreign'},{...note,anchor:noteAnchor({revision:2})},{...note,anchor:noteAnchor({contentHash:'f'.repeat(64)})},{...note,anchorState:'orphaned'},{...note,anchor:null},{...note,source:{kind:'ai',rawPrompt:'not permitted'}}])expect(verifyAnnotation(value,'story-1','note-1')).toBe(false)
    expect(verifyAnnotation(personalNote({anchorState:'orphaned',anchor:null,orphanReason:'passage_changed'}),'story-1','note-1')).toBe(true)
    fetchMock.mockResolvedValueOnce(response({...note,anchor:noteAnchor({sceneId:'foreign'})}))
    await expect(apiService.getStoryAnnotation('story-1','note-1')).rejects.toMatchObject({code:'story_contract'})
})
it('requires bounded ordered summaries and exact exclusive pagination while rejecting full note bodies',()=>{
    for(const value of [notePage({storyId:'foreign'}),notePage({items:[noteSummary(),noteSummary()]}),notePage({items:[noteSummary({createdRevision:6})]}),notePage({nextBefore:'2:note-1'}),notePage({items:[Object.assign(noteSummary(),{body:'private full body'})]})])expect(verifyAnnotationPage(value,'story-1')).toBe(false)
    expect(verifyAnnotationPage(notePage(),'story-1',{sceneId:'foreign'})).toBe(false)
    expect(verifyAnnotationPage(notePage(),'story-1',{state:'resolved'})).toBe(false)
    expect(verifyAnnotationPage(notePage(),'story-1',{anchorState:'orphaned'})).toBe(false)
    const items=Array.from({length:50},(_,index)=>noteSummary({id:'note-'+String(99-index),createdRevision:100-index}))
    expect(verifyAnnotationPage(notePage({annotationRevision:100,items,nextBefore:'51:note-50'}),'story-1')).toBe(true)
    expect(verifyAnnotationPage(notePage({items:[noteSummary({id:'note-0'})]}),'story-1',{before:'2:note-1'})).toBe(true)
    expect(verifyAnnotationPage(notePage(),'story-1',{before:'2:note-1'})).toBe(false)
})
it('requires the exact original operation receipt for fresh requests and read-only recovery',async()=>{
    const write=noteWrite(),ack=noteAck(write)
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(null))
    expect(await apiService.changeStoryAnnotation('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryAnnotationResult('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryAnnotationResult('story-1',write)).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(write)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/annotation-requests/note-create-1')
    for(const bad of [{...ack,storyId:'foreign'},{...ack,annotationId:'foreign'},{...ack,requestId:'different'},{...ack,revision:2},{...ack,operation:{...write.operation,body:'Reused intent'}}])expect(verifyAnnotationAck(bad,'story-1',write)).toBe(false)
})
it('keeps content and anchor version expectations independent in edit and reanchor receipts',()=>{
    const body={requestId:'edit-note',operation:{op:'edit' as const,id:'note-1',expectedRevision:2,body:'An edited note.'}}
    expect(verifyAnnotationAck({...noteAck(body),anchorVersion:9},'story-1',body)).toBe(true)
    const reanchor={requestId:'reanchor-note',operation:{op:'reanchor' as const,id:'note-1',expectedRevision:2,expectedAnchorVersion:9,anchor:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:8,quote:'The gate'}}}
    expect(verifyAnnotationAck(noteAck(reanchor),'story-1',reanchor)).toBe(true)
    expect(verifyAnnotationAck({...noteAck(reanchor),revision:3},'story-1',reanchor)).toBe(false)
    expect(verifyAnnotationAck({...noteAck(reanchor),anchorVersion:9},'story-1',reanchor)).toBe(false)
})
it('keeps all annotation methods behind the novels feature flag',async()=>{
    setTestFeatureFlags({ novels: false })
    for(const call of [()=>apiService.getStoryAnnotations('story-1'),()=>apiService.getStoryAnnotation('story-1','note-1'),()=>apiService.changeStoryAnnotation('story-1',noteWrite()),()=>apiService.getStoryAnnotationResult('story-1',noteWrite())])await expect(call()).rejects.toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
})
const paths=['page','detail','receipt'].map((name)=>'/tmp/novel-annotations-probe-'+name+'.json')
it.skipIf(paths.some((path)=>!existsSync(path)))('verifies actual isolated MySQL annotation summary, detail and receipt JSON',()=>{
    const [page,detail,{storyId,write,ack}]=paths.map((path)=>JSON.parse(readFileSync(path,'utf-8')))
    expect(verifyAnnotationPage(page,page.storyId)).toBe(true);expect(verifyAnnotation(detail,detail.storyId,detail.id)).toBe(true);expect(verifyAnnotationAck(ack,storyId,write)).toBe(true)
})
