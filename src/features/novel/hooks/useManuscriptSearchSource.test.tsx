import { renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { searchPage,searchResult } from '@/test/fixtures/storySearch'
const data=vi.hoisted(()=>({resolveStorySearchResult:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'author'}),useData:()=>data}))
import { useManuscriptSearchSource } from './useManuscriptSearchSource'
beforeEach(()=>{vi.clearAllMocks();data.resolveStorySearchResult.mockResolvedValue(searchResult())})
it('retains source identity and uses the latest owned cache resolver',async()=>{
    const search=vi.fn().mockResolvedValue(searchPage()),workspace={workspaceId:'desk',isCurrent:()=>true,detachedApi:()=>({searchStoryManuscript:search} as unknown as ApiService)}
    const view=renderHook(()=>useManuscriptSearchSource('story-1',workspace)),source=view.result.current!
    await source.search({q:'gate'});expect(search).toHaveBeenCalledWith('story-1',{q:'gate'})
    const newer=vi.fn().mockResolvedValue(searchResult());data.resolveStorySearchResult=newer;view.rerender()
    expect(view.result.current).toBe(source)
    const request={q:'gate',sourceSnapshot:'b'.repeat(64),target:{sceneId:'scene-1',position:4}}
    await source.resolve(request);expect(newer).toHaveBeenCalledWith('story-1',request)
})
it('rejects late old-scope pages and starts no further reads after a workspace switch',async()=>{
    let current=true,finish!:(value:ReturnType<typeof searchPage>)=>void
    const search=vi.fn(()=>new Promise((resolve)=>{finish=resolve})),workspace={workspaceId:'desk',isCurrent:()=>current,detachedApi:()=>({searchStoryManuscript:search} as unknown as ApiService)}
    const view=renderHook(()=>useManuscriptSearchSource('story-1',workspace)),source=view.result.current!,pending=source.search({q:'gate'})
    current=false;finish(searchPage());await expect(pending).rejects.toThrow('scope changed')
    await expect(source.search({q:'other'})).rejects.toThrow('scope changed');expect(search).toHaveBeenCalledOnce()
})
