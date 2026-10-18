import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { useContext, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { novel } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead } from '@/test/fixtures/storyStudio'
import { ApiError } from '@/infrastructure/api'
import * as retention from '@/features/novel/persistence/deviceNovelStorage'

const session=vi.hoisted(()=>({userHash:'life-author',accountKey:'life-author:1',authEpoch:1,workspaceId:'work-one',workspaceEpoch:1}))
const api=vi.hoisted(()=>({getCharacters:vi.fn(),getWorlds:vi.fn(),getItems:vi.fn(),getAdventureTemplates:vi.fn(),getAdventureSessions:vi.fn(),getCharacterChats:vi.fn(),getLorebooks:vi.fn(),getStories:vi.fn(),getStory:vi.fn(),getStoryStudioIndex:vi.fn(),getStoryStudioScene:vi.fn(),storyLifecycle:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({...session,isAuthenticated:true,sessionPhase:'authenticated',openLoginModal:vi.fn()})}))
vi.mock('../hooks/useWorkspace',()=>({useWorkspace:()=>({status:'ready',api,selectedWorkspaceId:session.workspaceId,workspaceEpoch:session.workspaceEpoch})}))
vi.mock('../hooks/usePageFocus',()=>({usePageFocus:()=>true,isPageFocused:()=>true}))
vi.mock('@/infrastructure',async(importOriginal)=>({...await importOriginal<typeof import('@/infrastructure')>(),apiService:api}))
import { DataProvider, DataContext } from './DataProvider'

const story=novel({organization:{workspace_id:'work-one'}})
const wrapper=({children}:{children:ReactNode})=><DataProvider>{children}</DataProvider>
const setup=()=>renderHook(()=>useContext(DataContext)!,{wrapper})
const journals=()=>Object.keys(localStorage).filter((key)=>key.includes('novel-lifecycle:'))
beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true })
    Object.assign(session,{userHash:'life-author',accountKey:'life-author:1',authEpoch:1,workspaceId:'work-one',workspaceEpoch:1})
    for(const name of ['getCharacters','getWorlds','getItems','getAdventureTemplates','getAdventureSessions','getCharacterChats','getLorebooks'] as const)api[name].mockResolvedValue([])
    api.getStories.mockResolvedValue([story]);api.getStoryStudioIndex.mockResolvedValue(studioIndex(story));api.storyLifecycle.mockResolvedValue({metadataRevision:2})
    api.getStoryStudioScene.mockImplementation(async(index,head)=>studioSceneRead(index,story.chapters.flatMap(chapter=>chapter.scenes).find(scene=>scene.id===head.id)!))
})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})

it('retires only the confirmed erased novel and refuses stale lists, readers and active setters',async()=>{
    const other=novel({id:'other-novel',organization:{workspace_id:'work-one'}})
    api.getStories.mockResolvedValue([story,other])
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(2))
    await act(async()=>{await view.result.current.openStory(story)})
    expect(view.result.current.activeStory?.id).toBe(story.id)
    localStorage.setItem('retained-device-draft','The author’s local prose')
    act(()=>view.result.current.forgetErasedStory(story.id))
    expect(view.result.current.activeStory).toBeNull();expect(view.result.current.sceneConfirmation).toBeNull()
    expect(view.result.current.stories.map((item)=>item.id)).toEqual([other.id])
    act(()=>{view.result.current.setActiveStory(studioIndex(story));view.result.current.setStories([story,other])})
    await act(async()=>{await view.result.current.refreshStory(story.id)})
    await act(async()=>{await expect(view.result.current.openStory(story)).rejects.toMatchObject({code:'STORY_ERASED'})})
    expect(view.result.current.activeStory).toBeNull();expect(view.result.current.stories.map((item)=>item.id)).toEqual([other.id])
    expect(localStorage.getItem('retained-device-draft')).toBe('The author’s local prose')
})

it('rejects a scene-opening result that arrives after confirmed erasure',async()=>{
    let finish!:(value:ReturnType<typeof studioSceneRead>)=>void
    api.getStoryStudioScene.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1));let opening!:Promise<void>
    act(()=>{opening=view.result.current.openStory(story).catch((error)=>{expect(error.code).toBe('STORY_ERASED')})})
    await waitFor(()=>expect(api.getStoryStudioScene).toHaveBeenCalledTimes(1))
    act(()=>view.result.current.forgetErasedStory(story.id))
    await act(async()=>{finish(studioSceneRead(studioIndex(story),story.chapters[0].scenes[0]));await opening})
    expect(view.result.current.activeStory).toBeNull();expect(view.result.current.sceneConfirmation).toBeNull()
})

it('ignores a retired erasure callback after an account and workspace transition',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    const retired=view.result.current.forgetErasedStory
    const other=novel({id:'other-owner-novel',organization:{workspace_id:'work-two'}})
    api.getStories.mockResolvedValue([other]);Object.assign(session,{userHash:'new-author',accountKey:'new-author:1',authEpoch:2,workspaceId:'work-two',workspaceEpoch:2});view.rerender()
    await waitFor(()=>expect(view.result.current.stories[0]?.id).toBe(other.id))
    act(()=>retired(other.id));expect(view.result.current.stories[0]?.id).toBe(other.id)
})

it('recovers an acknowledged-but-disconnected Trash operation after reload without reading the now-hidden novel first',async()=>{
    api.storyLifecycle.mockRejectedValueOnce(new Error('Response lost'))
    const first=setup()
    await waitFor(()=>expect(first.result.current.stories).toHaveLength(1))
    await act(async()=>{await expect(first.result.current.storyLifecycle(story.id,'trash')).rejects.toThrow('Response lost')})
    const original=api.storyLifecycle.mock.calls[0][1]
    expect(first.result.current.pendingStoryLifecycle[0].write).toEqual(original)
    first.unmount()
    api.getStories.mockResolvedValue([])
    api.getStoryStudioIndex.mockRejectedValue(new ApiError(404,'Novel is in Trash'))
    const second=setup()
    await waitFor(()=>expect(second.result.current.pendingStoryLifecycle).toHaveLength(1))
    await act(async()=>{await second.result.current.retryStoryLifecycle(story.id,original.requestId)})
    expect(api.storyLifecycle.mock.calls[1][1]).toEqual(original)
    expect(api.getStory).not.toHaveBeenCalled()
    expect(second.result.current.pendingStoryLifecycle).toEqual([])
    expect(journals()).toEqual([])
})

it('coalesces rapid duplicate requests and preserves the immutable action until it resolves',async()=>{
    let finish!:()=>void
    api.storyLifecycle.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    const view=setup()
    await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    let first!:Promise<void>,second!:Promise<void>
    act(()=>{first=view.result.current.storyLifecycle(story.id,'archive');second=view.result.current.storyLifecycle(story.id,'archive')})
    await waitFor(()=>expect(api.storyLifecycle).toHaveBeenCalledTimes(1))
    await act(async()=>{await expect(view.result.current.storyLifecycle(story.id,'trash')).rejects.toMatchObject({status:409})})
    await act(async()=>{finish();await Promise.all([first,second])})
    expect(api.storyLifecycle).toHaveBeenCalledTimes(1)
    expect(journals()).toEqual([])
})

it('isolates pending recovery and late acknowledgements across workspace and account switches',async()=>{
    let finish!:()=>void
    api.storyLifecycle.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    const view=setup()
    await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    let pending!:Promise<void>
    act(()=>{pending=view.result.current.storyLifecycle(story.id,'trash')})
    await waitFor(()=>expect(view.result.current.pendingStoryLifecycle).toHaveLength(1))
    const other=novel({id:'other-novel',organization:{workspace_id:'work-two'}})
    api.getStories.mockResolvedValue([other])
    Object.assign(session,{workspaceId:'work-two',workspaceEpoch:2,userHash:'second-author',accountKey:'second-author:1',authEpoch:2})
    view.rerender()
    expect(view.result.current.pendingStoryLifecycle).toEqual([])
    await waitFor(()=>expect(view.result.current.stories[0]?.id).toBe(other.id))
    await act(async()=>{finish();await pending})
    expect(view.result.current.stories[0]?.id).toBe(other.id)
    expect(view.result.current.pendingStoryLifecycle).toEqual([])
})

it('retires a definite conflict, refreshes account metadata, and never leaves a retry with a new request ID',async()=>{
    api.storyLifecycle.mockRejectedValueOnce(new ApiError(409,'Novel changed'))
    const latest=novel({...story,metadataRevision:4,title:'Renamed elsewhere'})
    api.getStoryStudioIndex.mockResolvedValue(studioIndex(latest))
    const view=setup()
    await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await expect(view.result.current.storyLifecycle(story.id,'archive')).rejects.toMatchObject({status:409})})
    expect(view.result.current.pendingStoryLifecycle).toEqual([])
    expect(view.result.current.stories[0].title).toBe(latest.title)
    expect(journals()).toEqual([])
    expect(api.storyLifecycle).toHaveBeenCalledTimes(1)
})

it('retains an acknowledged archive when the subsequent read fails and recovers the same receipt',async()=>{
    api.getStoryStudioIndex.mockRejectedValueOnce(new ApiError(404,'Reader temporarily unavailable'))
    const view=setup()
    await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await expect(view.result.current.storyLifecycle(story.id,'archive')).rejects.toMatchObject({status:404})})
    const original=api.storyLifecycle.mock.calls[0][1]
    expect(view.result.current.pendingStoryLifecycle).toHaveLength(1)
    await act(async()=>{await view.result.current.retryStoryLifecycle(story.id,original.requestId)})
    expect(api.storyLifecycle.mock.calls[1][1]).toEqual(original)
    expect(journals()).toEqual([])
})
it('retains a confirmed Trash restriction and terminal erasure independently of the hidden account reader',async()=>{
    const root=vi.spyOn(retention,'rememberDeviceNovelRoot').mockResolvedValue({status:'saved'})
    const erased=vi.spyOn(retention,'rememberDeviceNovelErased').mockResolvedValue({status:'saved'})
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    await act(async()=>{await view.result.current.storyLifecycle(story.id,'trash')})
    expect(root).toHaveBeenCalledWith(expect.objectContaining({userHash:'life-author',workspaceId:'work-one',storyId:story.id}),2,true,expect.any(Function))
    act(()=>view.result.current.forgetErasedStory(story.id))
    expect(erased).toHaveBeenCalledWith(expect.objectContaining({userHash:'life-author',workspaceId:'work-one',storyId:story.id}),expect.any(Function))
    expect(api.getStoryStudioIndex).not.toHaveBeenCalled()
})
it('does not retain an old account acknowledgement under the replacement author',async()=>{
    const root=vi.spyOn(retention,'rememberDeviceNovelRoot').mockResolvedValue({status:'saved'})
    const published=vi.spyOn(retention,'rememberDeviceNovelSource').mockResolvedValue({status:'saved'})
    let finish!:()=>void;api.storyLifecycle.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    const view=setup();await waitFor(()=>expect(view.result.current.stories).toHaveLength(1))
    let pending!:Promise<void>;act(()=>{pending=view.result.current.storyLifecycle(story.id,'trash')})
    await waitFor(()=>expect(api.storyLifecycle).toHaveBeenCalledTimes(1))
    const other=novel({id:'other-owner',organization:{workspace_id:'work-two'}});api.getStories.mockResolvedValue([other])
    Object.assign(session,{userHash:'new-author',accountKey:'new-author:1',authEpoch:2,workspaceId:'work-two',workspaceEpoch:2});view.rerender()
    await waitFor(()=>expect(view.result.current.stories[0]?.id).toBe(other.id))
    await act(async()=>{finish();await pending})
    expect(root).not.toHaveBeenCalled()
    expect(published.mock.calls.filter(([scope])=>scope.userHash==='new-author').every(([,source])=>source.id===other.id)).toBe(true)
})
