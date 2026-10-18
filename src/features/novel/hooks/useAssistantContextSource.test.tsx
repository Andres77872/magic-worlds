import { renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { assistantContextFixture } from '@/test/fixtures/storyAssistantContext'
const auth=vi.hoisted(()=>({userHash:'source-author' as string|null}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
import { useAssistantContextSource } from './useAssistantContextSource'
const fixture=()=>{
    const wire=assistantContextFixture(),read=vi.fn(async()=>wire.index),prepare=vi.fn(async()=>wire.result)
    const workspace={workspaceId:'desk',isCurrent:()=>true,detachedApi:()=>({getStoryStudioIndex:read,previewStoryAssistantContext:prepare} as unknown as ApiService)}
    const {sourceVersion,...options}=wire.request;void sourceVersion
    return {...wire,read,prepare,workspace,options}
}
beforeEach(()=>{auth.userHash='source-author'})
it('checks fresh scoped metadata, freezes options before awaiting and never saves or loads a whole novel',async()=>{
    const f=fixture();let finish!:(index:typeof f.index)=>void
    f.read.mockImplementation(()=>new Promise(done=>{finish=done}))
    const hook=renderHook(()=>useAssistantContextSource('story-1',f.workspace))
    const pending=hook.result.current!.prepare(f.options)
    f.options.message='Changed after dispatch';finish(f.index)
    expect(await pending).toEqual(f.result)
    expect(f.prepare).toHaveBeenCalledWith(f.index,f.request,{signal:undefined})
    expect(f.read).toHaveBeenCalledOnce()
})
it('retires a pending read before the second request on account/story changes and never resurrects its old token',async()=>{
    const f=fixture();let finish!:(index:typeof f.index)=>void
    f.read.mockImplementation(()=>new Promise(done=>{finish=done}))
    const hook=renderHook(({id})=>useAssistantContextSource(id,f.workspace),{initialProps:{id:'story-1'}})
    const first=hook.result.current!,pending=first.prepare(f.options)
    hook.rerender({id:'other'});finish(f.index)
    await expect(pending).rejects.toThrow('scope changed');expect(f.prepare).not.toHaveBeenCalled()
    hook.rerender({id:'story-1'});expect(first.isCurrent()).toBe(false)
    auth.userHash=null;hook.rerender({id:'story-1'});expect(hook.result.current).toBeNull()
    auth.userHash='source-author';hook.rerender({id:'story-1'});expect(first.isCurrent()).toBe(false)
    const last=hook.result.current!;hook.unmount();expect(last.isCurrent()).toBe(false)
})
it('refuses stale selections, aborted reads and device-only writers without context or mutation calls',async()=>{
    const f=fixture(),hook=renderHook(()=>useAssistantContextSource('story-1',f.workspace))
    const selection={sceneId:'scene-2',expectedRevision:99,expectedContentHash:'d'.repeat(64),startOffset:0,endOffset:3,quote:'The'}
    await expect(hook.result.current!.prepare({...f.options,scope:'selection',selection})).rejects.toMatchObject({code:'STORY_ASSISTANT_SOURCE_CHANGED'})
    expect(f.prepare).not.toHaveBeenCalled()
    const controller=new AbortController();controller.abort()
    await expect(hook.result.current!.prepare(f.options,controller.signal)).rejects.toThrow('scope changed')
    expect(f.read).toHaveBeenCalledOnce()
    const device=renderHook(()=>useAssistantContextSource('story-1',{...f.workspace,deviceOnly:true}))
    expect(device.result.current).toBeNull()
})
