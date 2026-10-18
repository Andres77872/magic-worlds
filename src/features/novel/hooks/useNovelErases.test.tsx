import { act,renderHook } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { eraseAck,erasePreview,eraseWrite } from '@/test/fixtures/storyErase'
const mocks=vi.hoisted(()=>({user:'erase-author',workspace:'work-one',epoch:1,authenticated:true,login:vi.fn(),forgot:vi.fn(),
    api:{previewStoryErase:vi.fn(),permanentlyEraseStory:vi.fn(),getStoryEraseResult:vi.fn()}}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:mocks.user,isAuthenticated:mocks.authenticated,openLoginModal:mocks.login})}))
vi.mock('@/app/hooks/usePlaylist',()=>({usePlaylist:()=>({})}))
vi.mock('@/app/hooks/useWorkspace',()=>({useWorkspace:()=>({api:mocks.api,selectedWorkspaceId:mocks.workspace,workspaceEpoch:mocks.epoch,
    capture:()=>[mocks.user,mocks.workspace,mocks.epoch].join(':'),isCurrent:(scope:string)=>scope===[mocks.user,mocks.workspace,mocks.epoch].join(':')})}))
import { useNovelErases } from './useNovelErases'

beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();mocks.user='erase-author';mocks.workspace='work-one';mocks.epoch=1;mocks.authenticated=true
    mocks.api.previewStoryErase.mockResolvedValue(erasePreview());mocks.api.permanentlyEraseStory.mockImplementation(async(_id,write)=>eraseAck(write));mocks.api.getStoryEraseResult.mockResolvedValue(null)
})
afterEach(()=>vi.restoreAllMocks())

it('persists the exact confirmation before POST and recovers a lost response by read alone',async()=>{
    const write=eraseWrite();mocks.api.permanentlyEraseStory.mockImplementationOnce(async()=>{
        expect(Object.keys(localStorage).some((key)=>key.includes('novel-erase:'))).toBe(true)
        throw new Error('Response lost')
    })
    const first=renderHook(()=>useNovelErases(false,mocks.forgot))
    await act(async()=>{await first.result.current.start(erasePreview(),write).catch(()=>{})})
    first.unmount();mocks.api.getStoryEraseResult.mockResolvedValue(eraseAck(write))
    const second=renderHook(()=>useNovelErases(false,mocks.forgot))
    await act(async()=>{await second.result.current.check(second.result.current.items[0])})
    expect(mocks.api.permanentlyEraseStory).toHaveBeenCalledTimes(1);expect(mocks.forgot).toHaveBeenCalledWith('story-1')
    expect(second.result.current.items).toEqual([]);expect(second.result.current.isErased('story-1')).toBe(true)
})

it('checks a missing result without a write, then retries only the original immutable intent',async()=>{
    mocks.api.permanentlyEraseStory.mockRejectedValueOnce(new Error('Offline'))
    const view=renderHook(()=>useNovelErases(false,mocks.forgot)),write=eraseWrite()
    await act(async()=>{await view.result.current.start(erasePreview(),write).catch(()=>{})})
    write.confirmedTitle='New caller input'
    await act(async()=>{await expect(view.result.current.start(erasePreview(),eraseWrite({requestId:'new-request'}))).rejects.toMatchObject({code:'STORY_PENDING_OPERATION'})})
    await act(async()=>{await view.result.current.check(view.result.current.items[0])})
    expect(view.result.current.items[0].checkedMissing).toBe(true);expect(mocks.api.permanentlyEraseStory).toHaveBeenCalledTimes(1)
    await act(async()=>{await view.result.current.retry(view.result.current.items[0])})
    expect(mocks.api.permanentlyEraseStory.mock.calls.map((call)=>call[1])).toEqual([eraseWrite(),eraseWrite()])
    expect(mocks.api.getStoryEraseResult).toHaveBeenCalledTimes(2)
})

it('allows archived receipt recovery but prevents fresh and missing-result erasures',async()=>{
    const record={storyId:'story-1',write:eraseWrite()},key=novelMutationKey('erase',{userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'},record.write.requestId)!
    writeNovelMutation(key,record)
    const view=renderHook(()=>useNovelErases(true,mocks.forgot))
    await act(async()=>{await view.result.current.start(erasePreview(),eraseWrite({requestId:'fresh'})).catch(()=>{})})
    await act(async()=>{await view.result.current.retry(view.result.current.items[0]).catch(()=>{})})
    expect(mocks.api.permanentlyEraseStory).not.toHaveBeenCalled();expect(view.result.current.items).toHaveLength(1)
    mocks.api.getStoryEraseResult.mockResolvedValue(eraseAck())
    await act(async()=>{await view.result.current.check(view.result.current.items[0])})
    expect(mocks.forgot).toHaveBeenCalledTimes(1);expect(view.result.current.items).toEqual([])
})

it('retains uncertain state when archive occurs during a result read',async()=>{
    const key=novelMutationKey('erase',{userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'},'erase-one')!
    writeNovelMutation(key,{storyId:'story-1',write:eraseWrite()})
    let readOnly=false,finish!:(value:null)=>void
    mocks.api.getStoryEraseResult.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(()=>useNovelErases(readOnly,mocks.forgot));let work!:ReturnType<typeof view.result.current.retry>
    act(()=>{work=view.result.current.retry(view.result.current.items[0]).catch(()=>null)})
    readOnly=true;view.rerender()
    await act(async()=>{finish(null);await work})
    expect(mocks.api.permanentlyEraseStory).not.toHaveBeenCalled();expect(view.result.current.items).toHaveLength(1)
})

it('never reissues a previously confirmed erase when its saved receipt is missing',async()=>{
    const key=novelMutationKey('erase',{userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'},'erase-one')!
    writeNovelMutation(key,{storyId:'story-1',write:eraseWrite(),ack:eraseAck()})
    const view=renderHook(()=>useNovelErases(false,mocks.forgot))
    await act(async()=>{await view.result.current.check(view.result.current.items[0]).catch(()=>{})})
    await act(async()=>{await view.result.current.retry(view.result.current.items[0]).catch(()=>{})})
    expect(mocks.api.permanentlyEraseStory).not.toHaveBeenCalled();expect(view.result.current.error).toBe('receiptMissing');expect(view.result.current.items).toHaveLength(1)
})

it('isolates late acknowledgements and retired callbacks, then recovers for the original owner',async()=>{
    let finish!:(value:ReturnType<typeof eraseAck>)=>void
    mocks.api.permanentlyEraseStory.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(()=>useNovelErases(false,mocks.forgot)),old=view.result.current;let work!:ReturnType<typeof old.start>
    act(()=>{work=old.start(erasePreview(),eraseWrite())})
    mocks.user='other-author';mocks.workspace='work-two';mocks.epoch=2;view.rerender()
    await act(async()=>{expect(await old.start(erasePreview(),eraseWrite())).toBeNull();expect(await old.preview('story-1')).toBeNull();finish(eraseAck());await work})
    expect(view.result.current.items).toEqual([]);expect(mocks.forgot).not.toHaveBeenCalled();expect(mocks.api.permanentlyEraseStory).toHaveBeenCalledTimes(1)
    mocks.user='erase-author';mocks.workspace='work-one';mocks.epoch=3;view.rerender()
    expect(view.result.current.items[0].write.ack).toEqual(eraseAck())
    mocks.api.getStoryEraseResult.mockResolvedValue(eraseAck())
    await act(async()=>{await view.result.current.check(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([]);expect(mocks.forgot).toHaveBeenCalledTimes(1)
})

it('keeps memory recovery across workspace epochs when device storage fails',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    mocks.api.permanentlyEraseStory.mockRejectedValueOnce(new Error('Offline'))
    const view=renderHook(()=>useNovelErases(false,mocks.forgot))
    await act(async()=>{await view.result.current.start(erasePreview(),eraseWrite()).catch(()=>{})})
    expect(view.result.current.items[0].storageFailed).toBe(true)
    mocks.workspace='work-two';mocks.epoch=2;view.rerender();expect(view.result.current.items).toEqual([])
    mocks.workspace='work-one';mocks.epoch=3;view.rerender();expect(view.result.current.items[0].write.write).toEqual(eraseWrite())
})

it('does not overwrite or retire newer input when an acknowledgement arrives',async()=>{
    let finish!:(value:ReturnType<typeof eraseAck>)=>void
    mocks.api.permanentlyEraseStory.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(()=>useNovelErases(false,mocks.forgot));let work!:ReturnType<typeof view.result.current.start>
    act(()=>{work=view.result.current.start(erasePreview(),eraseWrite())})
    const key=Object.keys(localStorage).find((value)=>value.includes('novel-erase:'))!
    const newer={storyId:'story-1',write:eraseWrite({confirmedTitle:'Newer unsent input'})}
    writeNovelMutation(key,newer)
    await act(async()=>{finish(eraseAck());await work})
    expect(JSON.parse(localStorage.getItem(key)!).write).toEqual(newer)
    expect(view.result.current.items[0].write).toEqual(newer)
})

it('retires definite source refusals but retains request conflicts and unknown results',async()=>{
    const view=renderHook(()=>useNovelErases(false,mocks.forgot))
    mocks.api.permanentlyEraseStory.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_ERASE_SOURCE_CHANGED'}))
    await act(async()=>{await view.result.current.start(erasePreview(),eraseWrite()).catch(()=>{})})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.error).toBe('changed')
    mocks.api.permanentlyEraseStory.mockRejectedValueOnce(new ApiError(409,'Conflict',{code:'STORY_REQUEST_ID_REUSED'}))
    await act(async()=>{await view.result.current.start(erasePreview(),eraseWrite({requestId:'conflict'})).catch(()=>{})})
    expect(view.result.current.items).toHaveLength(1);expect(view.result.current.error).toBe('requestConflict')
})

it('recognizes an already-erased target without inventing a receipt',async()=>{
    mocks.api.permanentlyEraseStory.mockRejectedValueOnce(new ApiError(410,'Erased',{code:'STORY_ERASED'}))
    const view=renderHook(()=>useNovelErases(false,mocks.forgot))
    await act(async()=>{expect(await view.result.current.start(erasePreview(),eraseWrite())).toBe('already-erased')})
    expect(view.result.current.items).toEqual([]);expect(mocks.forgot).toHaveBeenCalledWith('story-1')
})
