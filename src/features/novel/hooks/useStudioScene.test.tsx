import { useState } from 'react'
import { act,renderHook,waitFor } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { StoryScene,StoryStudioSource } from '@/shared'
import { novel,storyChapter,storyScene,manuscript } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead } from '@/test/fixtures/storyStudio'
import { applyStudioSceneAcknowledgement } from '@/shared/storyStudioState'
import { useStudioScene,type SceneConfirmation } from './useStudioScene'

const mocks=vi.hoisted(()=>({auth:{userHash:'writer',accountKey:'writer-account'},refresh:vi.fn(),consume:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>mocks.auth,useData:()=>({refreshStory:mocks.refresh,consumeSceneConfirmation:mocks.consume})}))
const a=storyScene({id:'first',document:manuscript('The first saved passage.','first-p')}),b=storyScene({id:'second',order:1,document:manuscript('The next saved passage.','second-p')})
const index=studioIndex(novel({chapters:[storyChapter({scenes:[a,b]})]}))
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>((done)=>{resolve=done});return {promise,resolve}}
const api={getStoryStudioScene:vi.fn()},owner={current:true}
const workspace={workspaceId:'desk',isCurrent:()=>owner.current,detachedApi:()=>api as never}
beforeEach(()=>{vi.clearAllMocks();owner.current=true;mocks.auth.accountKey='writer-account';mocks.refresh.mockResolvedValue(index)
    api.getStoryStudioScene.mockImplementation(async(source,head)=>studioSceneRead(source,head.id===a.id?a:b))})

function setup(source:StoryStudioSource=index,confirmation?:SceneConfirmation){
    return renderHook(({source,confirmation})=>{
        const [id,setId]=useState(a.id)
        const requested=source.chapters.flatMap((chapter)=>chapter.scenes).find((head)=>head.id===id)??null
        return useStudioScene({story:source,requested,unitId:id,workspace,confirmation,onSelect:setId})
    },{initialProps:{source,confirmation}})
}
it('does not invent an editable empty document while the initial scene is unavailable',async()=>{
    const pending=deferred<ReturnType<typeof studioSceneRead>>()
    api.getStoryStudioScene.mockReturnValueOnce(pending.promise)
    const view=setup()
    expect(view.result.current.scene).toBeNull()
    await waitFor(()=>expect(view.result.current.loading).toBe(true))
    await act(async()=>pending.resolve(studioSceneRead(index,a)))
    await waitFor(()=>expect(view.result.current.scene?.plainText).toBe(a.plainText))
    expect(api.getStoryStudioScene).toHaveBeenCalledTimes(1)
})
it('keeps the current seed until the next read verifies and cancels superseded responses',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const pending=deferred<ReturnType<typeof studioSceneRead>>()
    api.getStoryStudioScene.mockReturnValueOnce(pending.promise)
    let loading!:Promise<boolean>
    act(()=>{loading=view.result.current.select(b.id)})
    expect(view.result.current.scene?.id).toBe(a.id)
    expect(view.result.current.loading).toBe(true)
    await act(async()=>{expect(await view.result.current.select(a.id)).toBe(true)})
    await act(async()=>{pending.resolve(studioSceneRead(index,b));expect(await loading).toBe(false)})
    expect(view.result.current.scene?.id).toBe(a.id)
    expect(api.getStoryStudioScene.mock.calls[1][2].signal.aborted).toBe(true)
})
it('cancels an external review navigation and fences a late scene read',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const pending=deferred<ReturnType<typeof studioSceneRead>>(),abort=new AbortController()
    api.getStoryStudioScene.mockReturnValueOnce(pending.promise)
    let loading!:Promise<boolean>
    act(()=>{loading=view.result.current.select(b.id,index,abort.signal)})
    act(()=>abort.abort())
    await act(async()=>{pending.resolve(studioSceneRead(index,b));expect(await loading).toBe(false)})
    expect(view.result.current.scene?.id).toBe(a.id)
    expect(view.result.current.loading).toBe(false)
    expect(view.result.current.error).toBeNull()
    expect(api.getStoryStudioScene.mock.calls[1][2].signal.aborted).toBe(true)
    await act(async()=>{expect(await view.result.current.select(b.id)).toBe(true)})
    expect(view.result.current.scene?.id).toBe(b.id)
})
it('blocks a delayed switch after new writing and retries using the retained confirmed read without a write',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const pending=deferred<ReturnType<typeof studioSceneRead>>()
    api.getStoryStudioScene.mockReturnValueOnce(pending.promise)
    let canCommit=true,loading!:Promise<boolean>
    act(()=>{view.result.current.setSelectionGuard(()=>canCommit);loading=view.result.current.select(b.id)})
    canCommit=false
    await act(async()=>{pending.resolve(studioSceneRead(index,b));expect(await loading).toBe(false)})
    expect(view.result.current.error).toBe('inputChanged');expect(view.result.current.scene?.id).toBe(a.id)
    canCommit=true
    await act(async()=>{expect(await view.result.current.retry()).toBe(true)})
    expect(view.result.current.scene?.id).toBe(b.id)
    expect(api.getStoryStudioScene).toHaveBeenCalledTimes(2)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
})
it('defers a newer copy of the visible scene while the writer is busy instead of reporting a conflict',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const newer=storyScene({id:a.id,revision:2,contentHash:'d'.repeat(64),document:manuscript('Newer saved passage.','first-p')})
    const source=applyStudioSceneAcknowledgement(index,newer)
    api.getStoryStudioScene.mockImplementation(async(read,head)=>studioSceneRead(read,head.id===a.id?newer:b))
    let canCommit=false
    act(()=>view.result.current.setSelectionGuard(()=>canCommit))
    const calls=api.getStoryStudioScene.mock.calls.length
    view.rerender({source,confirmation:undefined})
    expect(view.result.current.error).toBeNull()
    expect(view.result.current.scene?.plainText).toBe(a.plainText)
    expect(api.getStoryStudioScene).toHaveBeenCalledTimes(calls)
    canCommit=true
    act(()=>view.result.current.recheckSelection())
    await waitFor(()=>expect(view.result.current.scene?.plainText).toBe(newer.plainText))
    expect(view.result.current.error).toBeNull()
})
it('retires old-scope responses without selecting or exposing their scene',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const pending=deferred<ReturnType<typeof studioSceneRead>>()
    api.getStoryStudioScene.mockReturnValueOnce(pending.promise)
    let loading!:Promise<boolean>
    act(()=>{loading=view.result.current.select(b.id)})
    owner.current=false
    view.rerender({source:index,confirmation:undefined})
    await act(async()=>{pending.resolve(studioSceneRead(index,b));expect(await loading).toBe(false)})
    expect(view.result.current.scene).toBeNull()
})
it('uses a verified opening read once and merges later acknowledged writing without refetching the tree or scene',async()=>{
    const first=studioSceneRead(index,a)
    const view=setup(index,{scene:a,read:first,sequence:1})
    await waitFor(()=>expect(mocks.consume).toHaveBeenCalledWith(1))
    expect(api.getStoryStudioScene).not.toHaveBeenCalled()
    const saved:StoryScene=storyScene({...a,revision:2,contentHash:'c'.repeat(64),document:manuscript('Later acknowledged writing.','first-p')})
    const source=applyStudioSceneAcknowledgement(index,saved)
    view.rerender({source,confirmation:{scene:saved,sequence:2}})
    await waitFor(()=>expect(view.result.current.scene?.plainText).toBe(saved.plainText))
    expect(mocks.consume).toHaveBeenCalledWith(2)
    expect(api.getStoryStudioScene).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
})

it('refuses a retained selection callback after the account changes even when the novel ID is identical',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const oldSelect=view.result.current.select
    mocks.auth.accountKey='another-account'
    view.rerender({source:index,confirmation:undefined})
    await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    api.getStoryStudioScene.mockClear()
    await act(async()=>{expect(await oldSelect(b.id)).toBe(false)})
    expect(view.result.current.scene?.id).toBe(a.id)
    expect(api.getStoryStudioScene).not.toHaveBeenCalled()
})

it('does not refresh a new account through a retained retry callback for the same novel',async()=>{
    const view=setup();await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    const retry=view.result.current.retry
    mocks.auth.accountKey='another-account'
    view.rerender({source:index,confirmation:undefined})
    await waitFor(()=>expect(view.result.current.scene?.id).toBe(a.id))
    mocks.refresh.mockClear()
    await act(async()=>{expect(await retry()).toBe(false)})
    expect(mocks.refresh).not.toHaveBeenCalled()
})
