import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { useContext,type ReactNode } from 'react'
import { act,renderHook,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead } from '@/test/fixtures/storyStudio'
import { creationAck } from '@/test/fixtures/storyCreation'
import { creationJournalKey } from '@/features/novel/persistence/creationJournal'
import { writeNovelMutation } from '@/shared/novelMutationJournal'
import { writingTemplate } from '@/features/novel/utils/writingTemplates'

const session=vi.hoisted(()=>({userHash:'create-author',accountKey:'create-author:1',authEpoch:1,workspaceId:'work-one',workspaceEpoch:1,archived:false}))
const api=vi.hoisted(()=>({getCharacters:vi.fn(),getWorlds:vi.fn(),getItems:vi.fn(),getAdventureTemplates:vi.fn(),getAdventureSessions:vi.fn(),getCharacterChats:vi.fn(),getLorebooks:vi.fn(),getStories:vi.fn(),getStory:vi.fn(),getStoryStudioIndex:vi.fn(),getStoryStudioScene:vi.fn(),createStory:vi.fn(),getStoryCreationResult:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({...session,isAuthenticated:true,sessionPhase:'authenticated',openLoginModal:vi.fn()})}))
vi.mock('../hooks/useWorkspace',()=>({useWorkspace:()=>({status:'ready',api,selectedWorkspaceId:session.workspaceId,workspaceEpoch:session.workspaceEpoch,workspaces:[{id:session.workspaceId,archived_at:session.archived?'2026-10-16T00:00:00Z':null}]})}))
vi.mock('../hooks/usePageFocus',()=>({usePageFocus:()=>true,isPageFocused:()=>true}))
vi.mock('@/infrastructure',async(original)=>({...await original<typeof import('@/infrastructure')>(),apiService:api}))
import { DataContext,DataProvider } from './DataProvider'

const request={title:'The gate',source:{kind:'blank' as const},chapters:[{title:'Opening',status:null}]}
const story=novel({id:'created-novel',title:'The gate',organization:{workspace_id:'work-one'}})
const wrapper=({children}:{children:ReactNode})=><DataProvider>{children}</DataProvider>
const setup=()=>renderHook(()=>useContext(DataContext)!,{wrapper})
beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true })
    Object.assign(session,{userHash:'create-author',accountKey:'create-author:1',authEpoch:1,workspaceId:'work-one',workspaceEpoch:1,archived:false})
    for(const name of ['getCharacters','getWorlds','getItems','getAdventureTemplates','getAdventureSessions','getCharacterChats','getLorebooks','getStories'] as const)api[name].mockResolvedValue([])
    api.createStory.mockImplementation(async(write)=>creationAck(write));api.getStoryStudioIndex.mockResolvedValue(studioIndex(story));api.getStoryCreationResult.mockResolvedValue(null)
    api.getStoryStudioScene.mockImplementation(async(index,head)=>studioSceneRead(index,story.chapters.flatMap(chapter=>chapter.scenes).find(scene=>scene.id===head.id)!))
})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})

it('journals creation before POST and retires it only after the created manuscript opens',async()=>{
    api.createStory.mockImplementation(async(write)=>{
        expect(Object.keys(localStorage).some((key)=>key.includes('novel-creation:'))).toBe(true)
        return creationAck(write)
    })
    const view=setup()
    await act(async()=>{await view.result.current.createStory(request)})
    expect(view.result.current.activeStory?.id).toBe(story.id)
    expect(api.getStoryStudioIndex).toHaveBeenCalledWith(story.id)
    expect(api.getStoryStudioScene).toHaveBeenCalledOnce()
    expect(api.getStory).not.toHaveBeenCalled()
    expect(view.result.current.activeStory?.chapters[0].scenes[0]).not.toHaveProperty('document')
    expect(view.result.current.novelCreations.items).toEqual([])
})
it('recovers a lost response after reload by reading the receipt without a second creation',async()=>{
    api.createStory.mockRejectedValueOnce(new Error('Response lost'))
    const first=setup()
    await act(async()=>{await expect(first.result.current.createStory(request)).rejects.toThrow('Response lost')})
    const write=api.createStory.mock.calls[0][0]
    first.unmount();api.getStoryCreationResult.mockResolvedValue(creationAck(write))
    const second=setup()
    await waitFor(()=>expect(second.result.current.novelCreations.items).toHaveLength(1))
    await act(async()=>{await second.result.current.novelCreations.retry(second.result.current.novelCreations.items[0])})
    expect(api.createStory).toHaveBeenCalledTimes(1)
    expect(second.result.current.activeStory).toBeNull()
    const ready=second.result.current.novelCreations.items[0]
    expect(ready.write.ack?.storyId).toBe(story.id)
    await act(async()=>{await second.result.current.novelCreations.open(ready)})
    expect(second.result.current.activeStory?.id).toBe(story.id)
})
it('recovers the frozen edited template after reload even when the caller changes its later preset',async()=>{
    const template=writingTemplate('three_acts',(key)=>key)
    template.defaults={narrator:'Mira, first person',styleGuide:'Concrete detail.'}
    template.chapters[0].title='An edited opening';template.chapters[0].wordGoal=800
    api.createStory.mockRejectedValueOnce(new Error('Response lost'))
    const first=setup()
    await act(async()=>{await expect(first.result.current.createStory({title:'The gate',template})).rejects.toThrow('Response lost')})
    const original=structuredClone(api.createStory.mock.calls[0][0])
    first.unmount();template.chapters[0].title='A later preset';template.defaults.narrator='Third person'
    api.getStoryCreationResult.mockResolvedValue(creationAck(original))
    const second=setup()
    await waitFor(()=>expect(second.result.current.novelCreations.items).toHaveLength(1))
    expect(second.result.current.novelCreations.items[0].write.write).toEqual(original)
    await act(async()=>{await second.result.current.novelCreations.retry(second.result.current.novelCreations.items[0])})
    expect(api.createStory).toHaveBeenCalledTimes(1)
    expect(api.getStoryCreationResult).toHaveBeenLastCalledWith(original)
})
it('retries the original immutable intent and blocks a replacement while its result is uncertain',async()=>{
    api.createStory.mockRejectedValueOnce(new Error('Response lost'))
    const view=setup()
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toThrow()})
    const original=api.createStory.mock.calls[0][0]
    await act(async()=>{await expect(view.result.current.createStory({...request,title:'Different'})).rejects.toMatchObject({code:'STORY_PENDING_OPERATION'})})
    await act(async()=>{await view.result.current.novelCreations.retry(view.result.current.novelCreations.items[0])})
    expect(api.createStory.mock.calls[1][0]).toEqual(original)
    expect(view.result.current.novelCreations.items[0].write.ack).toBeDefined()
})
it('keeps a confirmed receipt when the subsequent manuscript read fails',async()=>{
    api.getStoryStudioIndex.mockRejectedValueOnce(new Error('Reader unavailable'))
    const view=setup()
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toThrow('Reader unavailable')})
    expect(view.result.current.novelCreations.items[0].write.ack).toBeDefined()
    await act(async()=>{await view.result.current.novelCreations.open(view.result.current.novelCreations.items[0])})
    expect(api.createStory).toHaveBeenCalledTimes(1)
})
it('allows read recovery in an archived workspace and refuses an absent result without POST',async()=>{
    api.createStory.mockRejectedValueOnce(new Error('Response lost'))
    const view=setup()
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toThrow()})
    session.archived=true;view.rerender()
    const item=view.result.current.novelCreations.items[0]
    await act(async()=>{await expect(view.result.current.novelCreations.retry(item)).rejects.toMatchObject({code:'WORKSPACE_ARCHIVED'})})
    expect(api.createStory).toHaveBeenCalledTimes(1)
    api.getStoryCreationResult.mockResolvedValue(creationAck(item.write.write))
    await act(async()=>{await view.result.current.novelCreations.retry(item)})
    await act(async()=>{await view.result.current.novelCreations.open(view.result.current.novelCreations.items[0])})
    expect(view.result.current.activeStory?.id).toBe(story.id)
})
it('retains late receipts in the original scope and prevents stale records from creating in another workspace',async()=>{
    let finish!:(value:ReturnType<typeof creationAck>)=>void
    api.createStory.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=setup();let pending!:Promise<unknown>
    act(()=>{pending=view.result.current.createStory(request)})
    await waitFor(()=>expect(api.createStory).toHaveBeenCalledTimes(1))
    const original=view.result.current.novelCreations.items[0]
    Object.assign(session,{userHash:'second-author',accountKey:'second-author:1',authEpoch:2,workspaceId:'work-two',workspaceEpoch:2});view.rerender()
    await act(async()=>{finish(creationAck(original.write.write));await expect(pending).rejects.toMatchObject({code:'STORY_SCOPE_CHANGED'})})
    expect(view.result.current.novelCreations.items).toEqual([])
    expect(view.result.current.activeStory).toBeNull()
    await expect(view.result.current.novelCreations.retry(original)).rejects.toMatchObject({code:'STORY_SCOPE_CHANGED'})
    expect(api.createStory).toHaveBeenCalledTimes(1)
    Object.assign(session,{userHash:'create-author',accountKey:'create-author:3',authEpoch:3,workspaceId:'work-one',workspaceEpoch:3});view.rerender()
    await waitFor(()=>expect(view.result.current.novelCreations.items[0]?.write.ack).toBeDefined())
})
it('coalesces rapid identical creation calls and retains rejected input for review',async()=>{
    let finish!:(value:ReturnType<typeof creationAck>)=>void
    api.createStory.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=setup();let first!:Promise<unknown>,second!:Promise<unknown>
    act(()=>{first=view.result.current.createStory(request);second=view.result.current.createStory(request)})
    await waitFor(()=>expect(api.createStory).toHaveBeenCalledTimes(1))
    await act(async()=>{finish(creationAck(api.createStory.mock.calls[0][0]));await Promise.all([first,second])})
    api.createStory.mockRejectedValueOnce(new ApiError(422,'Invalid source'))
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toMatchObject({status:422})})
    expect(view.result.current.novelCreations.items).toHaveLength(1)
    expect(view.result.current.novelCreations.items[0].write.rejected).toBe('review_required')
})
it('adopts an old writer explicitly and retires only its exact recovered intent',async()=>{
    const write={...request,requestId:'old-creation'},key=creationJournalKey({userHash:session.userHash,workspaceId:session.workspaceId},write.requestId)!.replace(/::writer:.*/,'::writer:old-tab')
    writeNovelMutation(key,{write});api.getStoryCreationResult.mockResolvedValue(creationAck(write))
    const view=setup()
    await waitFor(()=>expect(view.result.current.novelCreations.items).toHaveLength(1))
    await act(async()=>{await view.result.current.novelCreations.retry(view.result.current.novelCreations.items[0])})
    expect(localStorage.getItem(key)).toBeNull()
    await act(async()=>{await view.result.current.novelCreations.open(view.result.current.novelCreations.items[0])})
    expect(Object.keys(localStorage).filter((key)=>key.includes('novel-creation:'))).toEqual([])
    expect(api.createStory).not.toHaveBeenCalled()
})

it('keeps an uncertain request in memory and exposes storage failure until its exact result opens',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Device storage unavailable')})
    api.createStory.mockRejectedValueOnce(new Error('Response lost'))
    const view=setup()
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toThrow('Response lost')})
    const pending=view.result.current.novelCreations.items[0]
    expect(pending.storageFailed).toBe(true)
    api.getStoryCreationResult.mockResolvedValue(creationAck(pending.write.write))
    await act(async()=>{await view.result.current.novelCreations.retry(pending)})
    expect(view.result.current.novelCreations.items[0].storageFailed).toBe(true)
    await act(async()=>{await view.result.current.novelCreations.open(view.result.current.novelCreations.items[0])})
    expect(view.result.current.novelCreations.items).toEqual([])
    expect(api.createStory).toHaveBeenCalledTimes(1)
})

it('retains rejected material and the exact edited outline across reload without reposting the rejected write',async()=>{
    const template=writingTemplate('custom',(key)=>key)
    template.chapters[0].title='Authored outline';template.chapters[0].scenes[0].details={notes:'Keep this planning note.'}
    const input={title:'The gate',description:'  Original description.  ',template,expectedSourceVersion:'a'.repeat(64),
        approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Mira llegó 🙂.\nThe gate stayed shut.  '}]}
    api.createStory.mockRejectedValueOnce(new ApiError(409,'Source changed',{code:'STORY_CREATION_SOURCE_CHANGED'}))
    const first=setup()
    await act(async()=>{await expect(first.result.current.createStory(input)).rejects.toMatchObject({code:'STORY_CREATION_SOURCE_CHANGED'})})
    const original=structuredClone(api.createStory.mock.calls[0][0]);first.unmount()
    input.template.chapters[0].title='A later edit';input.approvedMaterials[0].text='Changed by caller'
    const second=setup()
    await waitFor(()=>expect(second.result.current.novelCreations.items).toHaveLength(1))
    const retained=second.result.current.novelCreations.items[0]
    expect(retained.write).toEqual({write:original,rejected:'review_required'})
    await act(async()=>{expect(await second.result.current.novelCreations.retry(retained)).toBeNull()})
    expect(api.getStoryCreationResult).toHaveBeenLastCalledWith(original)
    expect(api.createStory).toHaveBeenCalledTimes(1)

    // Fresh review uses a new request; preserve both drafts until the confirmed result can be opened.
    api.getStoryStudioIndex.mockRejectedValueOnce(new Error('Reader unavailable'))
    const reviewed={...original,expectedSourceVersion:'b'.repeat(64)}
    await act(async()=>{await expect(second.result.current.createStory(reviewed,{replaceRejectedRequestId:original.requestId})).rejects.toThrow('Reader unavailable')})
    const replacement=api.createStory.mock.calls[1][0]
    expect(replacement.requestId).not.toBe(original.requestId)
    expect(replacement.template).toEqual(original.template)
    expect(replacement.approvedMaterials).toEqual(original.approvedMaterials)
    expect(replacement.replacesRequestId).toBeUndefined()
    expect(second.result.current.novelCreations.items).toHaveLength(2)
    second.unmount()
    const third=setup()
    await waitFor(()=>expect(third.result.current.novelCreations.items).toHaveLength(2))
    const ready=third.result.current.novelCreations.items.find((record)=>record.write.ack)!
    expect(ready.write.replacesRequestId).toBe(original.requestId)
    await act(async()=>{await third.result.current.novelCreations.open(ready)})
    expect(third.result.current.novelCreations.items).toEqual([])
    expect(api.createStory).toHaveBeenCalledTimes(2)
    expect(Object.keys(localStorage).filter((key)=>key.includes('novel-creation:'))).toEqual([])
})

it('recovers a receipt found for a rejected request and rejects an unowned replacement before POST',async()=>{
    api.createStory.mockRejectedValueOnce(new ApiError(422,'Invalid source'))
    const view=setup()
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toMatchObject({status:422})})
    const rejected=view.result.current.novelCreations.items[0]
    await act(async()=>{await expect(view.result.current.createStory(request,{replaceRejectedRequestId:'foreign-request'})).rejects.toMatchObject({code:'STORY_SCOPE_CHANGED'})})
    api.getStoryCreationResult.mockResolvedValue(creationAck(rejected.write.write))
    await act(async()=>{await view.result.current.novelCreations.retry(rejected)})
    expect(view.result.current.novelCreations.items[0].write.rejected).toBeUndefined()
    expect(view.result.current.novelCreations.items[0].write.ack).toBeDefined()
    await act(async()=>{await view.result.current.novelCreations.open(view.result.current.novelCreations.items[0])})
    expect(view.result.current.novelCreations.items).toEqual([])
    expect(api.createStory).toHaveBeenCalledTimes(1)
})

it('keeps the creation receipt and previous writer until the selected scene read succeeds',async()=>{
    const view=setup()
    await act(async()=>{await view.result.current.openStory(story)})
    const previous=view.result.current.activeStory
    api.getStoryStudioScene.mockRejectedValueOnce(new Error('Selected passage unavailable'))
    await act(async()=>{await expect(view.result.current.createStory(request)).rejects.toThrow('Selected passage unavailable')})
    expect(view.result.current.activeStory).toBe(previous)
    const receipt=view.result.current.novelCreations.items[0]
    expect(receipt.write.ack).toBeDefined()
    await act(async()=>{await view.result.current.novelCreations.open(receipt)})
    expect(view.result.current.novelCreations.items).toEqual([])
    expect(api.createStory).toHaveBeenCalledOnce()
    expect(api.getStory).not.toHaveBeenCalled()
})
