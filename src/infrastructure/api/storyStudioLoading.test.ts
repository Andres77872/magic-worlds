import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyGenerationHistoryPage,verifyGenerationDetail } from './storyGenerationHistoryContract'
import { studioExcerptsRequest,verifyStudioExcerpts } from './storyStudioExcerptsContract'
import { studioIndex,generationSummary,generationDetail,studioSceneRead } from '@/test/fixtures/storyStudio'
import { novel,storyScene,storyChapter } from '@/test/fixtures/story'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
const page=()=>({schemaVersion:1,storyId:'story-1',before:null,items:[generationSummary()],nextBefore:null})
beforeEach(()=>{vi.clearAllMocks();setTestFeatureFlags({ novels: true });vi.stubGlobal('fetch',fetchMock);localStorage.setItem('magic_worlds:token','test-token')})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('rejects full outputs in summary pages, excess previews, foreign details and repeated cursors',()=>{
    expect(verifyGenerationHistoryPage(page(),'story-1',null)).toBe(true)
    for(const patch of [{output:'Hidden full output'},{outputPreview:'🙂'.repeat(241)},{instructionPreview:'x'.repeat(241)},{storyId:'foreign'}]){
        expect(verifyGenerationHistoryPage({...page(),items:[{...generationSummary(),...patch}]},'story-1',null)).toBe(false)
    }
    expect(verifyGenerationHistoryPage({...page(),before:'generation-1',nextBefore:'generation-1'},'story-1','generation-1')).toBe(false)
    expect(verifyGenerationDetail(generationDetail(),'story-1','foreign')).toBe(false)
})
it('reads summary pages and one full generation through separate owned endpoints',async()=>{
    const signal=new AbortController().signal
    fetchMock.mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response(generationDetail()))
    expect(await apiService.getStoryGenerationHistory('story-1',null,{signal})).toEqual(page())
    expect(await apiService.getStoryGenerationHistoryDetail('story-1','generation-1',{signal})).toEqual(generationDetail())
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/stories\/story-1\/generation-history$/)
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/generation-history\/generation-1$/)
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal)
})
it('binds bounded Unicode excerpts to the exact ordered source heads before exposing them',async()=>{
    const source=studioIndex(),heads=source.chapters[0].scenes,request=studioExcerptsRequest(source,heads)!
    const value={schemaVersion:1,projection:'scene_excerpts',storyId:source.id,source:request,items:request.scenes.map(head=>({...head,text:'🙂'.repeat(240),truncated:true}))}
    expect(verifyStudioExcerpts(value,source.id,request)).toBe(true)
    expect(verifyStudioExcerpts({...value,items:[{...value.items[0],document:{}}]},source.id,request)).toBe(false)
    expect(studioExcerptsRequest(source,[{...heads[0],revision:2}])).toBeNull()
    fetchMock.mockResolvedValueOnce(response(value))
    expect(await apiService.getStoryStudioExcerpts(source,heads)).toEqual(value)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(request)
})
it('accepts the exact metadata receipt with a later index while rejecting a substituted request echo',async()=>{
    const write={requestId:'saved-metadata-request',expectedMetadataRevision:1,title:'Original title'}
    const index=studioIndex(novel({metadataRevision:3,title:'A later saved title'}))
    const value={acknowledgement:{id:index.id,metadataRevision:2},write,index}
    fetchMock.mockResolvedValueOnce(response(value)).mockResolvedValueOnce(response({...value,write:{...write,title:'Substituted'}}))
    expect((await apiService.updateStoryStudio(index.id,write)).title).toBe('A later saved title')
    await expect(apiService.updateStoryStudio(index.id,write)).rejects.toMatchObject({code:'story_studio_contract'})
})
it('reads only the document projection for recovery and rejects a substituted full-history response',async()=>{
    const value=studioSceneRead(studioIndex(novel({chapters:[storyChapter({scenes:[storyScene()]})]})),storyScene()).scene
    fetchMock.mockResolvedValueOnce(response(value)).mockResolvedValueOnce(response({...value,generationHistory:[]}))
    expect(await apiService.getStorySceneDocument('story-1','scene-1')).toEqual(value)
    expect(fetchMock.mock.calls[0][0]).toMatch(/scenes\/scene-1\?projection=document$/)
    await expect(apiService.getStorySceneDocument('story-1','scene-1')).rejects.toMatchObject({code:'story_studio_contract'})
})
it.skipIf(!process.env.NOVEL_STUDIO_INDEX_PERSISTENCE)('guards actual MySQL excerpt, paged history and exact metadata replay responses',()=>{
    const wire=JSON.parse(readFileSync(process.env.NOVEL_STUDIO_INDEX_PERSISTENCE!,'utf8'))
    expect(verifyStudioExcerpts(wire.excerpts,wire.index.id,wire.excerpts.source)).toBe(true)
    for(const page of wire.generationPages)expect(verifyGenerationHistoryPage(page,wire.index.id,page.before)).toBe(true)
    expect(verifyGenerationDetail(wire.generationDetail,wire.index.id,wire.generationDetail.generation.id)).toBe(true)
    expect(wire.metadataReplay.acknowledgement).toEqual(wire.metadataResult.acknowledgement)
    expect(wire.metadataReplay.index.metadataRevision).toBeGreaterThan(wire.metadataResult.acknowledgement.metadataRevision)
})
