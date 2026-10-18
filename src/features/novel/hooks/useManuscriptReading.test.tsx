import { act,renderHook,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { readingItem,readingWindow as readingPage } from '@/test/fixtures/storyReading'
import { useManuscriptReading } from './useManuscriptReading'
import type { ManuscriptReadingSource } from './useManuscriptReadingSource'
const options={scope:'novel' as const,unitId:null,includeArchived:false}
it('appends matching pages, retains earlier prose on a stale source and refreshes only explicitly',async()=>{
    const read=vi.fn().mockResolvedValueOnce(readingPage({totalScenes:3,items:[readingItem('one'),readingItem('two')],nextAfterSceneId:'two'}))
        .mockRejectedValueOnce(new ApiError(409,'Changed')).mockResolvedValueOnce(readingPage({sourceSnapshot:'c'.repeat(64),items:[readingItem('one')],navigation:{startSceneId:'one',beforeSceneId:null,previousBeforeSceneId:null,previousChapterId:null,previousPartId:null}}))
    const source:ManuscriptReadingSource={key:'owner',storyId:'story-1',isCurrent:()=>true,read}
    const {result}=renderHook(()=>useManuscriptReading(source,options))
    await waitFor(()=>expect(result.current.pages).toHaveLength(1))
    act(()=>result.current.loadMore());await waitFor(()=>expect(result.current.error).toBe('changed'))
    expect(result.current.pages[0].items[0].header.sceneId).toBe('one')
    act(()=>result.current.loadMore());expect(read).toHaveBeenCalledTimes(2)
    expect(read.mock.calls[1][0]).toMatchObject({sourceSnapshot:'b'.repeat(64),afterSceneId:'two',limit:2})
    act(()=>result.current.refresh());await waitFor(()=>expect(result.current.pages[0].sourceSnapshot).toBe('c'.repeat(64)))
})
it('drops old scope results and refuses duplicate or out-of-order continuation instead of mixing pages',async()=>{
    let resolve!:(value:ReturnType<typeof readingPage>)=>void
    const read=vi.fn().mockImplementationOnce(()=>new Promise((done)=>{resolve=done})).mockResolvedValueOnce(readingPage({scope:'chapter',unitId:'chapter-1'}))
    const source:ManuscriptReadingSource={key:'owner',storyId:'story-1',isCurrent:()=>true,read}
    const hook=renderHook(({scope})=>useManuscriptReading(source,scope),{initialProps:{scope:options as Parameters<typeof useManuscriptReading>[1]}})
    hook.rerender({scope:{...options,scope:'chapter',unitId:'chapter-1'}})
    await waitFor(()=>expect(hook.result.current.pages[0]?.scope).toBe('chapter'))
    await act(async()=>resolve(readingPage()))
    expect(hook.result.current.pages[0].scope).toBe('chapter')
    hook.unmount()
    const first=readingPage({totalScenes:3,items:[readingItem('one'),readingItem('two')],nextAfterSceneId:'two'})
    read.mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce(readingPage({offset:2,totalScenes:3,afterSceneId:'two',items:[readingItem('one')]}))
    const next=renderHook(()=>useManuscriptReading(source,options))
    await waitFor(()=>expect(next.result.current.pages).toHaveLength(1))
    act(()=>next.result.current.loadMore());await waitFor(()=>expect(next.result.current.error).toBe('failed'))
    expect(next.result.current.pages).toEqual([first])
})
