import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
const mocks=vi.hoisted(()=>({change:vi.fn(),refresh:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'codex-author',isAuthenticated:true,openLoginModal:vi.fn()}),useData:()=>({changeStoryCodex:mocks.change,refreshStory:mocks.refresh})}))
import { useCodexMutation } from './useCodexMutation'
const story=novel()
const workspace={workspaceId:'work-one',isCurrent:()=>true,detachedApi:()=>null}
const operation={op:'add' as const,refs:[{kind:'character' as const,cardId:'mira'},{kind:'world' as const,cardId:'gate'}]}
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();mocks.change.mockResolvedValue({contextRevision:2,refs:[]});mocks.refresh.mockResolvedValue(story)})

it('journals the whole selection as one immutable request and recovers the same request after reload',async()=>{
    mocks.change.mockRejectedValueOnce(new Error('Response lost'))
    const first=renderHook(()=>useCodexMutation(story,workspace,false,false))
    await act(async()=>{await expect(first.result.current.perform(operation)).rejects.toThrow('Response lost')})
    const original=mocks.change.mock.calls[0][1]
    expect(original).toMatchObject({requestId:expect.any(String),expectedContextRevision:1,operation})
    await act(async()=>{await expect(first.result.current.perform({op:'remove',id:'other'})).rejects.toMatchObject({status:409})})
    expect(mocks.change).toHaveBeenCalledTimes(1)
    first.unmount()
    const second=renderHook(()=>useCodexMutation(story,workspace,false,false))
    expect(second.result.current.pending).toEqual(original)
    await act(async()=>{await second.result.current.retry()})
    expect(mocks.change.mock.calls[1][1]).toEqual(original)
    expect(second.result.current.pending).toBeNull()
    expect(Object.keys(localStorage).filter((key)=>key.includes('novel-codex:'))).toEqual([])
})

it('replays a recovered request after its target was archived, while archived workspaces remain read-only',async()=>{
    mocks.change.mockRejectedValueOnce(new Error('Interrupted'))
    const first=renderHook(()=>useCodexMutation(story,workspace,false,false))
    await act(async()=>{await first.result.current.perform(operation).catch(()=>{})})
    first.unmount()
    const reader=renderHook(()=>useCodexMutation({...story,status:'archived'},workspace,true,false))
    await act(async()=>{await reader.result.current.retry()})
    expect(mocks.change).toHaveBeenCalledTimes(2)
    reader.unmount()
    const archived=renderHook(()=>useCodexMutation(story,workspace,true,true))
    await act(async()=>{await archived.result.current.perform(operation)})
    expect(mocks.change).toHaveBeenCalledTimes(2)
    expect(archived.result.current.canRetry).toBe(false)
})

it('uses the snapshot form revision, retires a definite conflict, and refreshes the account references',async()=>{
    mocks.change.mockRejectedValueOnce(new ApiError(409,'Changed elsewhere',{code:'STORY_CONTEXT_CONFLICT'}))
    const view=renderHook(()=>useCodexMutation({...story,contextRevision:5},workspace,false,false))
    await act(async()=>{await view.result.current.perform({op:'update',id:'ref-one',patch:{enabled:false}},2).catch(()=>{})})
    expect(mocks.change.mock.calls[0][1].expectedContextRevision).toBe(2)
    expect(mocks.refresh).toHaveBeenCalledWith(story.id)
    expect(view.result.current.pending).toBeNull()
    expect(view.result.current.error).toBe('codexConflict')
})

it('isolates a late acknowledgement from a newly opened novel',async()=>{
    let finish!:(value:unknown)=>void
    mocks.change.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(({current})=>useCodexMutation(current,workspace,false,false),{initialProps:{current:story}})
    let request!:Promise<void>
    act(()=>{request=view.result.current.perform(operation)})
    view.rerender({current:novel({id:'other-novel'})})
    expect(view.result.current.pending).toBeNull()
    await act(async()=>{finish({contextRevision:2,refs:[]});await request})
    expect(view.result.current.pending).toBeNull()
    expect(view.result.current.error).toBeNull()
})

it('transfers another writer durably so an acknowledged request cannot reappear on a later reload',async()=>{
    const old=novelMutationKey('codex',{userHash:'codex-author',workspaceId:'work-one',storyId:story.id},undefined,'old-writer')!
    writeNovelMutation(old,{requestId:'previous-request',expectedContextRevision:1,operation})
    mocks.change.mockRejectedValueOnce(new Error('Offline'))
    const first=renderHook(()=>useCodexMutation(story,workspace,false,false))
    await act(async()=>{await first.result.current.retry().catch(()=>{})})
    expect(localStorage.getItem(old)).toBeNull()
    first.unmount()
    const second=renderHook(()=>useCodexMutation(story,workspace,false,false))
    await act(async()=>{await second.result.current.retry()})
    second.unmount()
    const third=renderHook(()=>useCodexMutation(story,workspace,false,false))
    expect(third.result.current.pending).toBeNull()
})
