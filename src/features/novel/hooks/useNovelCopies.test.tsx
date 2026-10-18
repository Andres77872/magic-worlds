import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { copyAck,copyPreview,copyWrite } from '@/test/fixtures/storyCopy'
import { novel } from '@/test/fixtures/story'
const mocks=vi.hoisted(()=>({api:{previewStoryCopy:vi.fn(),copyStory:vi.fn(),getStoryCopyResult:vi.fn(),getStory:vi.fn()},open:vi.fn(),navigate:vi.fn(),user:'copy-author',workspace:'work-one',epoch:1}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:mocks.user,isAuthenticated:true,openLoginModal:vi.fn()}),useData:()=>({openStory:mocks.open}),useNavigation:()=>({setPage:mocks.navigate})}))
vi.mock('@/app/hooks/useWorkspace',()=>({useWorkspace:()=>({api:mocks.api,selectedWorkspaceId:mocks.workspace,workspaceEpoch:mocks.epoch,
    capture:()=>({accountKey:mocks.user,workspaceId:mocks.workspace,workspaceEpoch:mocks.epoch}),
    isCurrent:(owner:{accountKey:string;workspaceId:string;workspaceEpoch:number}|null)=>owner?.accountKey===mocks.user&&owner?.workspaceId===mocks.workspace&&owner?.workspaceEpoch===mocks.epoch})}))
import { useNovelCopies } from './useNovelCopies'

beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();mocks.user='copy-author';mocks.workspace='work-one';mocks.epoch=1
    mocks.api.copyStory.mockImplementation(async(_id,write)=>copyAck(write));mocks.api.getStoryCopyResult.mockResolvedValue(null)
    mocks.api.previewStoryCopy.mockResolvedValue(copyPreview());mocks.api.getStory.mockResolvedValue(novel({id:'story-copy'}));mocks.open.mockResolvedValue(undefined)
})

it('recovers a committed copy after reload using a read, without creating it again',async()=>{
    mocks.api.copyStory.mockRejectedValueOnce(new Error('Response lost'))
    const first=renderHook(()=>useNovelCopies(false)),write=copyWrite()
    await act(async()=>{await first.result.current.start(copyPreview(),write).catch(()=>{})})
    expect(first.result.current.items[0].write.write).toEqual(write)
    first.unmount();mocks.api.getStoryCopyResult.mockResolvedValue(copyAck(write))
    const second=renderHook(()=>useNovelCopies(false))
    await act(async()=>{await second.result.current.retry(second.result.current.items[0])})
    expect(mocks.api.copyStory).toHaveBeenCalledTimes(1)
    expect(mocks.api.getStoryCopyResult).toHaveBeenCalledWith('story-1',write)
    expect(second.result.current.items[0].write.ack).toEqual(copyAck(write))
    await act(async()=>{await second.result.current.open(second.result.current.items[0])})
    expect(mocks.navigate).toHaveBeenCalledWith('story');expect(second.result.current.items).toEqual([])
})

it('retries only the original immutable intent and blocks a second copy while it is uncertain',async()=>{
    mocks.api.copyStory.mockRejectedValueOnce(new Error('Offline'))
    const view=renderHook(()=>useNovelCopies(false)),write=copyWrite()
    await act(async()=>{await view.result.current.start(copyPreview(),write).catch(()=>{})})
    await act(async()=>{await expect(view.result.current.start(copyPreview(),copyWrite({requestId:'new-id'}))).rejects.toMatchObject({code:'STORY_PENDING_OPERATION'})})
    await act(async()=>{await view.result.current.retry(view.result.current.items[0])})
    expect(mocks.api.copyStory.mock.calls.map((call)=>call[1])).toEqual([write,write])
})

it('permits read-only result recovery in an archived workspace but never starts a missing copy',async()=>{
    const write=copyWrite(),key=novelMutationKey('copy',{userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'},write.requestId)!
    writeNovelMutation(key,{sourceId:'story-1',sourceTitle:'The gate',write})
    const view=renderHook(()=>useNovelCopies(true))
    await act(async()=>{await view.result.current.retry(view.result.current.items[0]).catch(()=>{})})
    expect(mocks.api.copyStory).not.toHaveBeenCalled();expect(view.result.current.error).toBe('archived')
    mocks.api.getStoryCopyResult.mockResolvedValue(copyAck(write))
    await act(async()=>{await view.result.current.retry(view.result.current.items[0])})
    expect(view.result.current.items[0].write.ack).toEqual(copyAck(write))
})

it('retires a definite stale-source rejection and requires a new preview',async()=>{
    mocks.api.copyStory.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_COPY_SOURCE_CHANGED'}))
    const view=renderHook(()=>useNovelCopies(false))
    await act(async()=>{await view.result.current.start(copyPreview(),copyWrite()).catch(()=>{})})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.error).toBe('changed')
    expect(Object.keys(localStorage).some((key)=>key.includes('novel-copy:'))).toBe(false)
})

it('isolates a late acknowledgement from a different account and workspace',async()=>{
    let finish!:(value:ReturnType<typeof copyAck>)=>void
    mocks.api.copyStory.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(()=>useNovelCopies(false));let request!:ReturnType<typeof view.result.current.start>
    act(()=>{request=view.result.current.start(copyPreview(),copyWrite())})
    mocks.user='other-author';mocks.workspace='work-two';mocks.epoch=2;view.rerender()
    await act(async()=>{finish(copyAck());await request})
    expect(view.result.current.items).toEqual([]);expect(mocks.open).not.toHaveBeenCalled();expect(mocks.navigate).not.toHaveBeenCalled()
    mocks.user='copy-author';mocks.workspace='work-one';mocks.epoch=1;view.rerender()
    expect(view.result.current.items[0].write.ack).toEqual(copyAck())
})

it('honors the editor save/review barrier before preview or a new copy',async()=>{
    const barrier=vi.fn().mockResolvedValue(false),view=renderHook(()=>useNovelCopies(false,barrier))
    await act(async()=>{expect(await view.result.current.preview('story-1')).toBeNull();await view.result.current.start(copyPreview(),copyWrite())})
    expect(mocks.api.previewStoryCopy).not.toHaveBeenCalled();expect(mocks.api.copyStory).not.toHaveBeenCalled()
})

it('transfers another writer and retires the exact acknowledged intent on dismissal',async()=>{
    const write=copyWrite(),key=novelMutationKey('copy',{userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'},write.requestId,'old-tab')!
    writeNovelMutation(key,{sourceId:'story-1',sourceTitle:'The gate',write})
    mocks.api.getStoryCopyResult.mockResolvedValue(copyAck(write))
    const view=renderHook(()=>useNovelCopies(false))
    await act(async()=>{await view.result.current.retry(view.result.current.items[0])})
    expect(localStorage.getItem(key)).toBeNull()
    act(()=>view.result.current.dismiss(view.result.current.items[0]));view.unmount()
    const reopened=renderHook(()=>useNovelCopies(false));expect(reopened.result.current.items).toEqual([])
})
