import { act,renderHook,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import type { StoryReadingRequest } from '@/shared/types/storyReading.types'
import { indexedReadingWindow,readerSceneId } from '@/test/fixtures/storyReadingWindow'
import { MAX_READER_PAGES,useManuscriptReading } from './useManuscriptReading'
const scope={scope:'novel' as const,unitId:null,includeArchived:false}
it('seeks near the end of a thousand-scene source with one bounded read, evicts old batches and returns backwards',async()=>{
    const read=vi.fn(async(query:StoryReadingRequest)=>indexedReadingWindow(query)),source={key:'owner',storyId:'story-1',isCurrent:()=>true,read}
    const hook=renderHook(()=>useManuscriptReading(source,scope,readerSceneId(990)))
    await waitFor(()=>expect(hook.result.current.busy).toBe(false))
    expect(read).toHaveBeenCalledOnce();expect(hook.result.current.pages[0].offset).toBe(990)
    for(let i=0;i<4;i++)await act(async()=>{hook.result.current.loadMore()})
    expect(hook.result.current.pages).toHaveLength(MAX_READER_PAGES)
    expect(hook.result.current.pages.flatMap((page)=>page.items)).toHaveLength(6)
    expect(hook.result.current.pages[0].offset).toBe(994)
    expect(hook.result.current.pages[2].items[1].header.sceneId).toBe(readerSceneId(999))
    const count=read.mock.calls.length;act(()=>hook.result.current.loadMore());expect(read).toHaveBeenCalledTimes(count)
    await act(async()=>hook.result.current.loadPrevious())
    expect(hook.result.current.pages.map((page)=>page.offset)).toEqual([992,994,996])
    expect(read.mock.calls[read.mock.calls.length-1][0]).toMatchObject({beforeSceneId:readerSceneId(994),sourceSnapshot:'b'.repeat(64),windowed:true})
    await act(async()=>hook.result.current.beginning());expect(hook.result.current.pages[0].offset).toBe(0)
    expect(read.mock.calls[read.mock.calls.length-1][0].startSceneId).toBeUndefined()
})
it('never automatically evicts the visible passage, including when the user scrolls back during a read',async()=>{
    let visible=readerSceneId(0),finish!:(value:ReturnType<typeof indexedReadingWindow>)=>void
    const read=vi.fn(async(query:StoryReadingRequest)=>indexedReadingWindow(query)),before=vi.fn()
    const source={key:'owner',storyId:'story-1',isCurrent:()=>true,read},hook=renderHook(()=>useManuscriptReading(source,scope,null,before,()=>visible))
    await waitFor(()=>expect(hook.result.current.busy).toBe(false))
    await act(async()=>hook.result.current.loadMore(true));await act(async()=>hook.result.current.loadMore(true))
    expect(read).toHaveBeenCalledTimes(3)
    await act(async()=>hook.result.current.loadMore(true));expect(read).toHaveBeenCalledTimes(3)
    visible=readerSceneId(4)
    read.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    act(()=>hook.result.current.loadMore(true));expect(hook.result.current.busy).toBe(true)
    visible=readerSceneId(0)
    await act(async()=>{finish(indexedReadingWindow(read.mock.calls[3][0]))})
    expect(hook.result.current.pages.map((page)=>page.offset)).toEqual([0,2,4]);expect(hook.result.current.busy).toBe(false)
    visible=readerSceneId(4)
    await act(async()=>hook.result.current.loadMore(true))
    expect(hook.result.current.pages.map((page)=>page.offset)).toEqual([2,4,6]);expect(before).toHaveBeenLastCalledWith(readerSceneId(6))
})
