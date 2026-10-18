import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyStoryStructureAcknowledgement } from './storyContract'
import { verifySnapshotAnnotationCollection,verifySnapshotAnnotationDetail,verifySnapshotAnnotationPage } from './storySnapshotAnnotationContract'
import { verifySnapshotDetail,verifySnapshotManifest } from './storySnapshotContract'
import { isSnapshotCreateOperation } from '@/shared/storySnapshotOperation'
import { annotatedSnapshot,snapshotNoteReaders,snapshotNoteIndex } from '@/test/fixtures/storySnapshotNotes'
import { snapshotOperation,snapshotManifest } from '@/test/fixtures/storySnapshots'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','snapshot-note-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('reads metadata and a captured note through the captured account/workspace scope',async()=>{
    const snapshot=annotatedSnapshot(),index=snapshotNoteIndex(),query={state:'resolved' as const}
    const page=await snapshotNoteReaders.notes(snapshot,query),detail=await snapshotNoteReaders.note(snapshot,index)
    fetchMock.mockResolvedValueOnce(response(page)).mockResolvedValueOnce(response(detail))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.getStorySnapshotAnnotations(snapshot,query)).toEqual(page)
    expect(await api.getStorySnapshotAnnotation(snapshot,index)).toEqual(detail)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stories/story-1/snapshots/3/annotations?state=resolved')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111'})
})
it('binds metadata pages to the exact captured membership, ordering, filter and manifest',async()=>{
    const snapshot=annotatedSnapshot(),page=await snapshotNoteReaders.notes(snapshot)
    expect(verifySnapshotAnnotationPage(page,snapshot)).toBe(true)
    expect(verifySnapshotAnnotationPage({...page,manifestHash:'f'.repeat(64)},snapshot)).toBe(false)
    expect(verifySnapshotAnnotationPage({...page,annotationRevision:7},snapshot)).toBe(false)
    expect(verifySnapshotAnnotationPage({...page,items:[]},snapshot)).toBe(false)
    expect(verifySnapshotAnnotationPage(page,snapshot,{state:'open'})).toBe(false)
    expect(verifySnapshotAnnotationPage({...page,items:[{...page.items[0],body:'Smuggled body'}]},snapshot)).toBe(false)
    expect(verifySnapshotAnnotationPage(page,{...snapshot,manifest:snapshotManifest()})).toBe(false)
})
it('rejects wrong note versions, states, checkpoint targets and incomplete historical records',async()=>{
    const snapshot=annotatedSnapshot(),index=snapshotNoteIndex(),detail=await snapshotNoteReaders.note(snapshot,index)
    expect(verifySnapshotAnnotationDetail(detail,snapshot,index)).toBe(true)
    for(const patch of [{state:'open'},{body:'Current note text'},{revision:8},{head:{}},{anchor:{...detail.note.anchor,revision:3}},{source:{kind:'manual',extra:true}}]){
        expect(verifySnapshotAnnotationDetail({...detail,note:{...detail.note,...patch}},snapshot,index)).toBe(false)
    }
    expect(verifySnapshotAnnotationDetail({...detail,contentHash:'f'.repeat(64)},snapshot,index)).toBe(false)
    fetchMock.mockResolvedValueOnce(response({...detail,snapshotId:4}))
    await expect(apiService.getStorySnapshotAnnotation(snapshot,index)).rejects.toMatchObject({code:'story_contract'})
})
it('distinguishes legacy captures and empty captured collections, and preserves old uncertain intents',()=>{
    const legacy=snapshotManifest(),empty={...legacy,annotations:{revision:1,notes:[]}}
    expect(verifySnapshotManifest(legacy,'story-1')).toBe(true)
    expect(verifySnapshotManifest(empty,'story-1')).toBe(true)
    expect(verifySnapshotManifest({...legacy,annotations:null},'story-1')).toBe(false)
    expect(isSnapshotCreateOperation(snapshotOperation())).toBe(true)
    expect(isSnapshotCreateOperation({...snapshotOperation(),sourceAnnotationRevision:6})).toBe(true)
    expect(isSnapshotCreateOperation({...snapshotOperation(),sourceAnnotationRevision:null})).toBe(false)
})
it('requires the original reviewed annotation head in capture and recovered receipts',async()=>{
    const operation={...snapshotOperation(),sourceAnnotationRevision:6},write={requestId:'capture-notes',expectedStructureRevision:5,operation}
    const ack={structureRevision:6,selectedId:null,snapshot:{requestId:write.requestId,storyId:'story-1',operation,id:6,sourceVersion:operation.expectedSourceVersion,manifestHash:'d'.repeat(64),counts:{parts:0,chapters:1,scenes:1,references:1}}}
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack))
    expect(await apiService.changeStoryStructure('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryStructureResult('story-1',write)).toEqual(ack)
    const changed={...ack,snapshot:{...ack.snapshot,operation:{...operation,sourceAnnotationRevision:7}}}
    expect(verifyStoryStructureAcknowledgement(changed,5,{storyId:'story-1',write})).toBe(false)
    const omitted=snapshotOperation()
    expect(verifyStoryStructureAcknowledgement({...ack,snapshot:{...ack.snapshot,operation:omitted}},5,{storyId:'story-1',write})).toBe(false)
})
it('uses binary Unicode ID ordering and rejects future collection event pointers',()=>{
    const index=snapshotNoteIndex(),scenes=new Set([index.sceneId])
    const notes=[{...index,id:'\ue000'},{...index,id:'🌒'}]
    expect(verifySnapshotAnnotationCollection({revision:6,notes},scenes)).toBe(true)
    expect(verifySnapshotAnnotationCollection({revision:6,notes:[...notes].reverse()},scenes)).toBe(false)
    expect(verifySnapshotAnnotationCollection({revision:6,notes:[{...index,anchorEvent:7}]},scenes)).toBe(false)
})
const file='/tmp/novel-snapshot-annotations-wire.json'
it.skipIf(!existsSync(file))('accepts actual MySQL frozen manifests, small pages and reconstructed note wire records',()=>{
    const {snapshot,page,detail}=JSON.parse(readFileSync(file,'utf8'))
    expect(verifySnapshotDetail(snapshot,snapshot.storyId,snapshot.id)).toBe(true)
    expect(verifySnapshotAnnotationPage(page,snapshot)).toBe(true)
    const index=snapshot.manifest.annotations.notes.find((item:{id:string})=>item.id===detail.note.id)
    expect(verifySnapshotAnnotationDetail(detail,snapshot,index)).toBe(true)
})
