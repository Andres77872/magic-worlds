import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyStoryStructureAcknowledgement } from './storyContract'
import { verifySnapshotComparison,verifySnapshotDetail,verifySnapshotManifest,verifySnapshotPage,verifySnapshotPreview,verifySnapshotScene } from './storySnapshotContract'
import { snapshotComparison,snapshotManifest,snapshotOperation,snapshotPage,snapshotPreview,snapshotView } from '@/test/fixtures/storySnapshots'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','snapshot-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('reads owned snapshot previews, small pages, manifests and the exact frozen scene',async()=>{
    const comparison=snapshotComparison(),{current:_,...detail}=comparison
    void _
    for(const value of [snapshotPreview(),snapshotPage(),detail,comparison,snapshotView()])fetchMock.mockResolvedValueOnce(response(value))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.getStorySnapshotPreview('story-1')).toEqual(snapshotPreview())
    expect(await api.getStorySnapshots('story-1',4)).toEqual(snapshotPage())
    expect(await api.getStorySnapshot('story-1',3)).toEqual(detail)
    expect(await api.compareStorySnapshot('story-1',3)).toEqual(comparison)
    const expected=detail.manifest.chapters[0].scenes[0]
    expect(await api.getStorySnapshotScene('story-1',3,expected,detail.manifestHash)).toEqual(snapshotView())
    expect(String(fetchMock.mock.calls[1][0])).toContain('/snapshots?before=4')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111','Authorization':'Bearer snapshot-token'})
})
it('requires a complete exact capture receipt before retiring its journal',async()=>{
    const operation=snapshotOperation(),write={requestId:'snapshot-1',expectedStructureRevision:5,operation}
    const ack={structureRevision:6,selectedId:null,snapshot:{requestId:write.requestId,storyId:'story-1',operation,id:6,sourceVersion:operation.expectedSourceVersion,manifestHash:'d'.repeat(64),counts:snapshotPreview().counts}}
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack))
    expect(await apiService.changeStoryStructure('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryStructureResult('story-1',write)).toEqual(ack)
    expect(verifyStoryStructureAcknowledgement({structureRevision:6,selectedId:null},5,{storyId:'story-1',write})).toBe(false)
    expect(verifyStoryStructureAcknowledgement({...ack,snapshot:{...ack.snapshot,operation:{...operation,title:'Wrong capture'}}},5,{storyId:'story-1',write})).toBe(false)
    expect(verifyStoryStructureAcknowledgement({...ack,snapshot:{...ack.snapshot,id:7}},5,{storyId:'story-1',write})).toBe(false)
})
it('rejects foreign, smuggled-body, future-format and mismatched frozen metadata',async()=>{
    const detail=snapshotComparison(),scene=detail.manifest.chapters[0].scenes[0]
    expect(verifySnapshotDetail({...detail,storyId:'foreign'},'story-1',3)).toBe(false)
    expect(verifySnapshotManifest({...detail.manifest,schemaVersion:2},'story-1')).toBe(false)
    const invalid=snapshotManifest();Object.assign(invalid.chapters[0].scenes[0],{document:{schemaVersion:1}})
    expect(verifySnapshotManifest(invalid,'story-1')).toBe(false)
    expect(verifySnapshotPage({...snapshotPage(),items:[{...snapshotPage().items[0],manifest:detail.manifest}]},'story-1')).toBe(false)
    expect(verifySnapshotScene({...snapshotView(),scene:{...snapshotView().scene,revision:4}},'story-1',3,scene,detail.manifestHash)).toBe(false)
    fetchMock.mockResolvedValueOnce(response({...snapshotView(),manifestHash:'e'.repeat(64)}))
    await expect(apiService.getStorySnapshotScene('story-1',3,scene,detail.manifestHash)).rejects.toMatchObject({code:'story_contract'})
})
it('keeps snapshot methods behind the existing novels feature flag',async()=>{
    setTestFeatureFlags({ novels: false })
    await expect(apiService.getStorySnapshots('story-1')).rejects.toThrow('Novels are disabled.')
    expect(fetchMock).not.toHaveBeenCalled()
})
const files=['detail','comparison','scene','page','receipt'].map((name)=>'/tmp/novel-snapshot-smoke-'+name+'.json')
it.skipIf(files.some((path)=>!existsSync(path)))('verifies actual isolated MySQL manifest, scene and exact receipt payloads',()=>{
    const [detail,comparison,view,page,receipt]=files.map((path)=>JSON.parse(readFileSync(path,'utf-8')))
    expect(verifySnapshotDetail(detail,detail.storyId,detail.id)).toBe(true)
    expect(verifySnapshotComparison(comparison,detail.storyId,detail.id)).toBe(true)
    expect(verifySnapshotPage(page,detail.storyId)).toBe(true)
    const scene=detail.manifest.chapters.flatMap((chapter: {scenes:Array<{id:string}>})=>chapter.scenes).find((scene:{id:string})=>scene.id===view.scene.id)
    expect(verifySnapshotScene(view,detail.storyId,detail.id,scene,detail.manifestHash)).toBe(true)
    expect(verifyStoryStructureAcknowledgement(receipt.ack,receipt.write.expectedStructureRevision,{storyId:receipt.storyId,write:receipt.write})).toBe(true)
    expect(verifySnapshotPreview(snapshotPreview(),'story-1')).toBe(true)
})
