import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { studioSceneRead } from '@/test/fixtures/storyStudio'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { apiService } from './index'
import { verifyStory } from './storyContract'
import { storyStudioSceneRequest,verifyStoryStudioIndex,verifyStoryStudioScene } from './storyStudioContract'

function fixture():StoryStudioIndex {
    const full=novel({chapters:[storyChapter({scenes:[storyScene({copiedFromRevision:null})]})]})
    const {body:_body,activeCardRefs:_refs,generationHistory:_history,...chapter}=full.chapters[0]
    const {document:_document,body:_sceneBody,plainText:_text,activeCardRefs:_sceneRefs,generationHistory:_sceneHistory,...head}=chapter.scenes[0]
    void [_body,_refs,_history,_document,_sceneBody,_text,_sceneRefs,_sceneHistory]
    return {...full,schemaVersion:1,projection:'studio_index',sourceVersion:'b'.repeat(64),chapters:[{...chapter,scenes:[{...head,copiedFromRevision:null,statistics:null}]}]}
}
const fetchMock=vi.fn()
const response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();setTestFeatureFlags({ novels: true });vi.stubGlobal('fetch',fetchMock);localStorage.setItem('magic_worlds:token','test-token')})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})

it('accepts the separate index but never treats unloaded heads as editable empty documents',()=>{
    const index=fixture()
    expect(verifyStoryStudioIndex(index,index.id)).toBe(true)
    expect(verifyStory(index)).toBe(false)
    expect(index.chapters[0].scenes[0]).not.toHaveProperty('document')
})
it.each(['document','body','plainText','generationHistory','activeCardRefs'])('rejects an unexpected %s in an unloaded scene',key=>{
    const index=fixture();Object.assign(index.chapters[0].scenes[0],{[key]:key==='body'?'':[]})
    expect(verifyStoryStudioIndex(index)).toBe(false)
})
it('rejects unknown parents, stale counters and falsely complete chapter histories',()=>{
    const index=fixture();index.chapters[0].partId='missing'
    expect(verifyStoryStudioIndex(index)).toBe(false)
    index.chapters[0].partId=null
    Object.assign(index.chapters[0].scenes[0],{statistics:{schemaVersion:1,algorithm:'icu-word-en-v1',sourceRevision:2,contentHash:'a'.repeat(64),wordCount:0,characterCount:0,textBytes:0}})
    expect(verifyStoryStudioIndex(index)).toBe(false)
    index.chapters[0].scenes[0].statistics=null;Object.assign(index.chapters[0],{generationHistory:[]})
    expect(verifyStoryStudioIndex(index)).toBe(false)
})
it('binds complete scene reads to root, ancestor and selected-scene heads',()=>{
    const index=fixture(),head=index.chapters[0].scenes[0],source=storyStudioSceneRequest(index,head)!
    const result=studioSceneRead(index,storyScene({copiedFromRevision:null}))
    expect(verifyStoryStudioScene(result,index,head)).toBe(true)
    expect(verifyStoryStudioScene({...result,source:{...source,chapterMetadataRevision:2}},index,head)).toBe(false)
    expect(verifyStoryStudioScene({...result,scene:{...result.scene,chapterId:'other'}},index,head)).toBe(false)
    expect(verifyStoryStudioScene({...result,scene:{...result.scene,generationHistory:[]}},index,head)).toBe(false)
    expect(storyStudioSceneRequest(index,{...head,contentHash:'c'.repeat(64)})).toBe(null)
})
it('uses dedicated owned endpoints, preserves the exact read preconditions and honours the feature flag',async()=>{
    const index=fixture(),scene=index.chapters[0].scenes[0],source=storyStudioSceneRequest(index,scene)!
    fetchMock.mockResolvedValueOnce(response(index)).mockResolvedValueOnce(response(studioSceneRead(index,storyScene({copiedFromRevision:null}))))
    expect(await apiService.getStoryStudioIndex(index.id)).toEqual(index)
    expect((await apiService.getStoryStudioScene(index,scene)).scene.id).toBe(scene.id)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/stories\/story-1\/studio-index$/)
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/stories\/story-1\/studio-scenes\/scene-1$/)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(source)
    setTestFeatureFlags({ novels: false })
    await expect(apiService.getStoryStudioIndex(index.id)).rejects.toThrow('Novels are disabled.')
    await expect(apiService.getStoryStudioScene(index,scene)).rejects.toThrow('Novels are disabled.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('rejects truncated or foreign index/scene responses without exposing editable prose',async()=>{
    const index=fixture(),scene=index.chapters[0].scenes[0]
    fetchMock.mockResolvedValueOnce(response({...index,id:'foreign'})).mockResolvedValueOnce(response({scene:storyScene()}))
    await expect(apiService.getStoryStudioIndex(index.id)).rejects.toMatchObject({status:502,code:'story_studio_contract'})
    await expect(apiService.getStoryStudioScene(index,scene)).rejects.toMatchObject({status:502,code:'story_studio_contract'})
})
it.skipIf(!process.env.NOVEL_STUDIO_INDEX_PERSISTENCE)('verifies actual native index, selected-scene and prior full-scene wire shapes',()=>{
    const fixture=JSON.parse(readFileSync(process.env.NOVEL_STUDIO_INDEX_PERSISTENCE!,'utf8'))
    expect(verifyStoryStudioIndex(fixture.index,fixture.index.id)).toBe(true)
    const scene=fixture.index.chapters.flatMap((chapter:StoryStudioIndex['chapters'][number])=>chapter.scenes).find((item:{id:string})=>item.id===fixture.selected.scene.id)
    expect(verifyStoryStudioScene(fixture.selected,fixture.index,scene)).toBe(true)
    expect(fixture.legacy.document).toEqual(fixture.selected.scene.document)
    expect(fixture.legacy.activeCardRefs).toEqual(fixture.selected.scene.activeCardRefs)
    expect(Array.isArray(fixture.legacy.generationHistory)).toBe(true)
    expect(fixture.selected.scene).not.toHaveProperty('generationHistory')
})
