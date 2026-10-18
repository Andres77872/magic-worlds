import { act,renderHook,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { studioIndex,generationSummary,generationDetail } from '@/test/fixtures/storyStudio'
import type { StoryGenerationHistoryPage } from '@/shared'
import { useGenerationHistory } from './useGenerationHistory'
import type { GenerationHistorySource } from './useGenerationHistorySource'
const first:StoryGenerationHistoryPage={schemaVersion:1,storyId:'story-1',before:null,items:[generationSummary()],nextBefore:'generation-1'}
const second:StoryGenerationHistoryPage={...first,before:'generation-1',items:[generationSummary({id:'older',createdAt:'2026-10-15T00:00:00Z'})],nextBefore:null}
function source(key='owner-one'){return {key,isCurrent:()=>true,page:vi.fn(async(before)=>before?second:first),detail:vi.fn(async()=>generationDetail())} satisfies GenerationHistorySource}
it('opens bounded metadata pages and reads a full output only after an explicit request',async()=>{
    const owner=source(),story=studioIndex()
    const view=renderHook(()=>useGenerationHistory({story,source:owner,open:true}))
    await waitFor(()=>expect(view.result.current.generations).toHaveLength(1))
    expect(view.result.current.generations[0]).not.toHaveProperty('output');expect(owner.detail).not.toHaveBeenCalled()
    let full:unknown
    await act(async()=>{full=await view.result.current.readGeneration(view.result.current.generations[0])})
    expect(full).toMatchObject({output:'The complete saved output.',location:'active'});expect(owner.detail).toHaveBeenCalledOnce()
    act(()=>view.result.current.next());await waitFor(()=>expect(view.result.current.generations[0].id).toBe('older'))
    expect(view.result.current.hasPrevious).toBe(true)
    act(()=>view.result.current.previous());await waitFor(()=>expect(view.result.current.generations[0].id).toBe('generation-1'))
    expect(owner.page.mock.calls.map(call=>call[0])).toEqual([null,'generation-1',null])
})
it.each(['archived','trashed'] as const)('retains a refreshed %s location when merging a full cached generation',async location=>{
    const owner=source(),story=studioIndex()
    owner.page.mockResolvedValue({...first,items:[generationSummary({location})]})
    const view=renderHook(()=>useGenerationHistory({story,source:owner,open:true}))
    act(()=>view.result.current.record(generationDetail().generation,'Opening'))
    await waitFor(()=>expect(view.result.current.generations[0]).toMatchObject({location,output:'The complete saved output.'}))
    expect(await view.result.current.readGeneration(view.result.current.generations[0])).toMatchObject({location})
    expect(owner.detail).not.toHaveBeenCalled()
})
it('ignores old-owner pages and retained read/status callbacks for the same novel',async()=>{
    let finish!:(page:StoryGenerationHistoryPage)=>void
    const old=source(),current=source('owner-two')
    old.page.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    current.page.mockResolvedValue({...first,items:[]})
    const story=studioIndex(),view=renderHook(({owner})=>useGenerationHistory({story,source:owner,open:true}),{initialProps:{owner:old}})
    const read=view.result.current.readGeneration,patch=view.result.current.patchStatus,record=view.result.current.record
    view.rerender({owner:current})
    await act(async()=>{finish(first)})
    await waitFor(()=>expect(view.result.current.loading).toBe(false))
    await act(async()=>{expect(await read(generationSummary())).toBeNull();patch('generation-1','accepted');record(generationDetail().generation,'Old chapter','Old instruction')})
    expect(view.result.current.generations).toEqual([]);expect(current.detail).not.toHaveBeenCalled()
})

it('retires history navigation and refresh callbacks before they can read the new owner',async()=>{
    const old=source(),current=source('owner-two'),story=studioIndex()
    const view=renderHook(({owner})=>useGenerationHistory({story,source:owner,open:true}),{initialProps:{owner:old}})
    await waitFor(()=>expect(view.result.current.loading).toBe(false))
    const refresh=view.result.current.refresh,next=view.result.current.next
    view.rerender({owner:current})
    await waitFor(()=>expect(current.page).toHaveBeenCalledTimes(1))
    await waitFor(()=>expect(view.result.current.loading).toBe(false))
    await act(async()=>{refresh();next()})
    expect(current.page).toHaveBeenCalledTimes(1)
    expect(view.result.current.generations[0].id).toBe('generation-1')
})
it('bypasses oversized confirmed outputs without modifying the candidate owned by its caller',()=>{
    const owner=source(),story=studioIndex(),view=renderHook(()=>useGenerationHistory({story,source:owner,open:false}))
    const candidate={...generationDetail().generation,output:'A'.repeat(17*1024*1024)}
    act(()=>view.result.current.record(candidate,'Opening','An exact instruction'))
    expect(view.result.current.generations).toEqual([])
    expect(candidate.output).toHaveLength(17*1024*1024)
    expect(owner.page).not.toHaveBeenCalled()
    act(()=>view.result.current.record({...candidate,output:'The saved small output.'},'Opening'))
    expect(view.result.current.generations[0]).toMatchObject({output:'The saved small output.'})
})
