import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { isAnnotationAnchor,isAnnotationSelection,isAnnotationWrite,verifyAnnotation,verifyAnnotationPage,verifyAnnotationAck,verifyAnnotationCore,verifyAnnotationCopyPreview } from './storyAnnotationContract'
import { isStoryCopyWrite,verifyStoryCopyAcknowledgement,verifyStoryCopyPreview,verifyStoryCopyProvenance } from './storyCopyContract'
import { verifySnapshotAnnotationDetail,verifySnapshotAnnotationPage } from './storySnapshotAnnotationContract'
import { verifySnapshotDetail } from './storySnapshotContract'
import type { StoryAnnotationWrite } from '@/shared'
import { noteAck,noteAnchor,notePage,noteSummary,noteWrite,personalNote } from '@/test/fixtures/storyAnnotations'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
const point=()=>noteAnchor({quote:'',start:{nodeId:'current-gate',offset:3},end:{nodeId:'current-gate',offset:3}})
const bookmark=()=>personalNote({id:'bookmark-1',kind:'bookmark',body:'Return here',origin:point(),anchor:point(),lastAnchor:point()})
const page=()=>notePage({items:[noteSummary({id:'bookmark-1',kind:'bookmark',bodyPreview:'Return here',quotePreview:''})]})
function write():StoryAnnotationWrite{return {requestId:'bookmark-create',operation:{op:'create',id:'bookmark-1',kind:'bookmark',body:'Return here',anchor:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:3,endOffset:3,quote:''}}}}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','bookmark-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})

it('accepts exact point bookmarks while keeping note creation and kind markers strict',()=>{
    const value=write();expect(isAnnotationWrite(value)).toBe(true)
    expect(isAnnotationAnchor(point())).toBe(true)
    expect(verifyAnnotation(bookmark(),'story-1','bookmark-1')).toBe(true)
    if(value.operation.op!=='create')throw new Error('Fixture')
    expect(isAnnotationSelection(value.operation.anchor)).toBe(true)
    for(const patch of [{kind:undefined},{kind:null},{kind:'note'},{kind:'bookmark',body:'x'.repeat(256)},{kind:'bookmark',body:'  '}]){
        expect(isAnnotationWrite({...value,operation:{...value.operation,...patch}})).toBe(false)
    }
    const {kind,...noteOperation}=value.operation;expect(kind).toBe('bookmark')
    expect(isAnnotationWrite({...value,operation:noteOperation})).toBe(false)
    expect(isAnnotationWrite(noteWrite())).toBe(true)
    expect(isAnnotationAnchor({...point(),end:{nodeId:'current-gate',offset:4}})).toBe(false)
    expect(isAnnotationSelection({...value.operation.anchor,endOffset:4})).toBe(false)
})

it('reads and filters bookmarks explicitly without mixing them into note pages or copy counts',async()=>{
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response(bookmark()))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.getStoryAnnotations('story-1',{kind:'bookmark',state:'open'})).toEqual(page())
    expect(await api.getStoryAnnotation('story-1','bookmark-1')).toEqual(bookmark())
    expect(String(fetchMock.mock.calls[0][0])).toContain('state=open&kind=bookmark')
    expect(verifyAnnotationPage(page(),'story-1')).toBe(false)
    expect(verifyAnnotationPage(notePage(),'story-1',{kind:'bookmark'})).toBe(false)
    const counts={storyId:'story-1',annotationRevision:8,kind:'bookmark',scenes:[{sceneId:'scene-1',open:2,resolved:0,trashed:1}]}
    expect(verifyAnnotationCopyPreview(counts,'story-1','bookmark')).toBe(true)
    expect(verifyAnnotationCopyPreview(counts,'story-1')).toBe(false)
    expect(verifyAnnotationCopyPreview({...counts,scenes:[{...counts.scenes[0],resolved:1}]},'story-1','bookmark')).toBe(false)
    fetchMock.mockResolvedValueOnce(response(counts))
    await api.getStoryAnnotationCopyPreview('story-1','bookmark')
    expect(String(fetchMock.mock.calls[2][0])).toContain('annotation-copy-preview?kind=bookmark')
})

it('verifies exact bookmark receipts and rejects a substituted kind, point, or longer label',async()=>{
    const value=write(),ack=noteAck(value)
    expect(verifyAnnotationAck(ack,'story-1',value)).toBe(true)
    fetchMock.mockResolvedValueOnce(response(ack))
    expect(await apiService.changeStoryAnnotation('story-1',value)).toEqual(ack)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(value)
    for(const patch of [{kind:'unknown'},{state:'resolved'},{body:'x'.repeat(256)},{kind:undefined}]){
        expect(verifyAnnotation({...bookmark(),...patch},'story-1','bookmark-1')).toBe(false)
    }
    if(value.operation.op!=='create')throw new Error('Fixture')
    expect(verifyAnnotationAck({...ack,operation:{...value.operation,body:'Different label'}},'story-1',value)).toBe(false)
})

const native=process.env.NOVEL_BOOKMARKS_PERSISTENCE
it.skipIf(!native||!existsSync(native))('verifies actual isolated MySQL point/bookmark, snapshot and copy JSON using the frontend guards',()=>{
    const value=JSON.parse(readFileSync(native!,'utf8'))
    expect(isAnnotationWrite(value.createWrite)).toBe(true)
    expect(verifyAnnotationAck(value.createAck,value.storyId,value.createWrite)).toBe(true)
    expect(verifyAnnotation(value.detail,value.storyId,'bookmark-1')).toBe(true)
    expect(verifyAnnotation(value.copyDetail,value.storyId,value.copyDetail.id)).toBe(true)
    expect(verifyAnnotationPage(value.page,value.storyId,{kind:'bookmark'})).toBe(true)
    expect(verifyAnnotationCore(value.oldFrozenNote.note,value.storyId,'original-note')).toBe(true)
    expect(verifySnapshotDetail(value.snapshot,value.storyId,value.snapshot.id)).toBe(true)
    expect(verifySnapshotAnnotationPage(value.snapshotPage,value.snapshot,{kind:'bookmark'})).toBe(true)
    const index=value.snapshotPage.items.find((item:{id:string})=>item.id==='bookmark-1')
    expect(verifySnapshotAnnotationDetail(value.snapshotDetail,value.snapshot,index)).toBe(true)
    expect(verifyStoryCopyPreview(value.copyPreview,value.storyId)).toBe(true)
    expect(isStoryCopyWrite(value.copyWrite)).toBe(true)
    expect(verifyStoryCopyAcknowledgement(value.copyAck,value.storyId,value.copyWrite)).toBe(true)
    expect(verifyStoryCopyProvenance(value.copyProvenance,value.copyAck.storyId)).toBe(true)
})
