import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { useContext,type ReactNode } from 'react'
import { act,renderHook,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { novel,storyChapter,storyScene,storyReference,storyGeneration } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead } from '@/test/fixtures/storyStudio'
import { storyOutlineSummary } from '@/shared/storyStudioState'
import { searchResult } from '@/test/fixtures/storySearch'

const session=vi.hoisted(()=>({userHash:'search-author',accountKey:'search-author:1',authEpoch:1,workspaceId:'desk',workspaceEpoch:1}))
const api=vi.hoisted(()=>({getCharacters:vi.fn(),getWorlds:vi.fn(),getItems:vi.fn(),getAdventureTemplates:vi.fn(),getAdventureSessions:vi.fn(),getCharacterChats:vi.fn(),getLorebooks:vi.fn(),getStories:vi.fn(),getStory:vi.fn(),getStoryStudioIndex:vi.fn(),getStoryStudioScene:vi.fn(),resolveStoryManuscriptSearch:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({...session,isAuthenticated:true,sessionPhase:'authenticated',openLoginModal:vi.fn()})}))
vi.mock('../hooks/useWorkspace',()=>({useWorkspace:()=>({status:'ready',api,selectedWorkspaceId:session.workspaceId,workspaceEpoch:session.workspaceEpoch})}))
vi.mock('../hooks/usePageFocus',()=>({usePageFocus:()=>true,isPageFocused:()=>true}))
vi.mock('@/infrastructure',async(importOriginal)=>({...await importOriginal<typeof import('@/infrastructure')>(),apiService:api}))
import { DataProvider,DataContext } from './DataProvider'
const wrapper=({children}:{children:ReactNode})=><DataProvider>{children}</DataProvider>
const setup=()=>renderHook(()=>useContext(DataContext)!,{wrapper})
const request={q:'gate',sourceSnapshot:'b'.repeat(64),target:{sceneId:'scene-1',position:4}}
const reference=storyReference(),generation=storyGeneration()
const saved=novel({organization:{workspace_id:'desk'},activeCardRefs:[reference],chapters:[storyChapter({scenes:[storyScene({generationHistory:[generation]})]})]})
beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true })
    Object.assign(session,{userHash:'search-author',accountKey:'search-author:1',authEpoch:1,workspaceId:'desk',workspaceEpoch:1})
    for(const name of ['getCharacters','getWorlds','getItems','getAdventureTemplates','getAdventureSessions','getCharacterChats','getLorebooks'] as const)api[name].mockResolvedValue([])
    api.getStories.mockResolvedValue([storyOutlineSummary(saved)]);api.getStoryStudioIndex.mockResolvedValue(studioIndex(saved));api.getStoryStudioScene.mockImplementation(async(index)=>studioSceneRead(index,saved.chapters[0].scenes[0]));api.resolveStoryManuscriptSearch.mockResolvedValue(searchResult())
})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})
it('opens the exact device scene using fresh account projections and an explicit in-memory selection',async()=>{
    const second=storyScene({id:'device-reopen-scene',order:1,title:'Device scene'})
    const index=studioIndex({...saved,chapters:[storyChapter({scenes:[saved.chapters[0].scenes[0],second]})]})
    api.getStoryStudioIndex.mockResolvedValue(index);api.getStoryStudioScene.mockResolvedValue(studioSceneRead(index,second))
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Optional view storage blocked')})
    await act(async()=>{await view.result.current.openStory(saved,second.id)})
    expect(api.getStoryStudioScene).toHaveBeenCalledWith(index,expect.objectContaining({id:second.id}))
    expect(view.result.current.sceneConfirmation).toMatchObject({select:true,scene:{id:second.id}})
    expect(view.result.current.activeStory?.chapters[0].scenes).toHaveLength(2)
})
it('refuses to substitute another account scene when the requested device scene is absent',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await expect(view.result.current.openStory(saved,'removed-device-scene')).rejects.toMatchObject({code:'STORY_SCENE_UNAVAILABLE'})})
    expect(api.getStoryStudioScene).not.toHaveBeenCalled()
    expect(view.result.current.activeStory).toBeNull()
})
it('resolves a compatible saved target without fetching full prose or polluting outline/library metadata',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await view.result.current.openStory(saved)})
    api.getStoryStudioIndex.mockClear()
    await act(async()=>{await view.result.current.resolveStorySearchResult('story-1',request)})
    expect(view.result.current.activeStory?.activeCardRefs).toEqual([reference])
    expect(view.result.current.activeStory?.chapters[0].scenes[0]).not.toHaveProperty('document')
    expect(view.result.current.activeStory?.chapters[0].scenes[0]).not.toHaveProperty('generationHistory')
    expect(view.result.current.stories[0].chapters).toEqual([])
    expect(view.result.current.sceneConfirmation?.scene.document).toEqual(saved.chapters[0].scenes[0].document)
    expect(api.getStoryStudioIndex).not.toHaveBeenCalled();expect(api.getStory).not.toHaveBeenCalled()
})
it('refreshes an obsolete index and revalidates the same source before adopting its target',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await view.result.current.openStory(saved)})
    api.getStoryStudioIndex.mockClear()
    api.resolveStoryManuscriptSearch.mockResolvedValue(searchResult({sourceMetadataRevision:2}));api.getStoryStudioIndex.mockResolvedValue(studioIndex({...saved,metadataRevision:2}))
    await act(async()=>{await view.result.current.resolveStorySearchResult('story-1',request)})
    expect(api.getStoryStudioIndex).toHaveBeenCalledOnce();expect(api.resolveStoryManuscriptSearch).toHaveBeenCalledTimes(2)
    expect(view.result.current.stories[0].metadataRevision).toBe(2)
    expect(api.getStory).not.toHaveBeenCalled()
})
it('rejects a late workspace response before caching or refreshing its manuscript',async()=>{
    let finish!:(value:ReturnType<typeof searchResult>)=>void
    api.resolveStoryManuscriptSearch.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    let pending!:ReturnType<typeof view.result.current.resolveStorySearchResult>
    act(()=>{pending=view.result.current.resolveStorySearchResult('story-1',request)})
    session.workspaceEpoch++;session.workspaceId='other';view.rerender()
    await act(async()=>{finish(searchResult());await expect(pending).rejects.toMatchObject({code:'STORY_SCOPE_CHANGED'})})
    expect(api.getStory).not.toHaveBeenCalled();expect(view.result.current.activeStory).toBeNull()
})
