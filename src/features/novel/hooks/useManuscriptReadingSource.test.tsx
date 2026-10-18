import { renderHook } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { readingPage } from '@/test/fixtures/storyReading'
const auth=vi.hoisted(()=>({userHash:'reader-author' as string|null}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
import { useManuscriptReadingSource } from './useManuscriptReadingSource'
it('retains captured workspace identity and retires old reads across story changes, sign-out/relogin and unmount',async()=>{
    let finish!:(page:ReturnType<typeof readingPage>)=>void
    const read=vi.fn(()=>new Promise<ReturnType<typeof readingPage>>((done)=>{finish=done})),workspace={workspaceId:'desk',isCurrent:()=>true,detachedApi:()=>({readStoryManuscript:read} as unknown as ApiService)}
    const hook=renderHook(({id})=>useManuscriptReadingSource(id,workspace),{initialProps:{id:'story-1'}})
    const first=hook.result.current!,pending=first.read({})
    hook.rerender({id:'other'});finish(readingPage());await expect(pending).rejects.toThrow('scope changed')
    hook.rerender({id:'story-1'});expect(first.isCurrent()).toBe(false)
    auth.userHash=null;hook.rerender({id:'story-1'});expect(hook.result.current).toBeNull()
    auth.userHash='reader-author';hook.rerender({id:'story-1'});expect(first.isCurrent()).toBe(false)
    const last=hook.result.current!;hook.unmount();expect(last.isCurrent()).toBe(false)
    await expect(last.read({})).rejects.toThrow('scope changed');expect(read).toHaveBeenCalledOnce()
})
