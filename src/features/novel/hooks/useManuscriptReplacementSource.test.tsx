import { renderHook } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { replacementPreview } from '@/test/fixtures/storyReplacement'
const auth=vi.hoisted(()=>({userHash:'replacement-author' as string|null}))
const data=vi.hoisted(()=>({refreshStory:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth,useData:()=>data}))
import { useManuscriptReplacementSource } from './useManuscriptReplacementSource'
it('retires original owners permanently across same-account re-login and never starts a stale preview',async()=>{
    let finish!:(value:ReturnType<typeof replacementPreview>)=>void
    const read=vi.fn(()=>new Promise<ReturnType<typeof replacementPreview>>((resolve)=>{finish=resolve})),workspace={workspaceId:'desk',isCurrent:()=>true,detachedApi:()=>({previewStoryReplacement:read} as unknown as ApiService)}
    const view=renderHook(()=>useManuscriptReplacementSource('story-1',workspace)),first=view.result.current!,review=replacementPreview()
    if(review.operation.op!=='replace')throw new Error('Fixture')
    const request=first.preview(review.operation.preview)
    auth.userHash=null;view.rerender();auth.userHash='replacement-author';view.rerender()
    finish(review);await expect(request).rejects.toThrow('owner changed');expect(first.isCurrent()).toBe(false)
    await expect(first.preview(review.operation.preview)).rejects.toThrow('owner changed');expect(read).toHaveBeenCalledOnce()
    const last=view.result.current!;view.unmount();expect(last.isCurrent()).toBe(false)
})
