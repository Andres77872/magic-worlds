import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { currentRevisionScene,sceneRestoreAck,sceneRestoreWrite } from '@/test/fixtures/storyRevisions'
import { listSceneRestoreJournals,sceneRestoreTarget,type SceneRestoreIntent } from '../persistence/sceneRestoreJournal'

const mocks=vi.hoisted(()=>({user:'restore-author',workspace:'work-one',story:'story-1',readOnly:false,authenticated:true,login:vi.fn(),data:{restoreStoryRevision:vi.fn(),recoverStoryRevision:vi.fn(),refreshStoryScene:vi.fn()}}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:mocks.user,isAuthenticated:mocks.authenticated,openLoginModal:mocks.login}),useData:()=>mocks.data}))
import { useSceneRestores } from './useSceneRestores'
const one={workspaceId:'work-one',isCurrent:()=>mocks.workspace==='work-one'&&mocks.user==='restore-author',detachedApi:()=>null}
const two={workspaceId:'work-two',isCurrent:()=>mocks.workspace==='work-two'&&mocks.user==='other-author',detachedApi:()=>null}
const useRestore=()=>useSceneRestores(mocks.story,mocks.workspace==='work-one'?one:two,mocks.readOnly)
const intent=(requestId='restore-scene-1'):SceneRestoreIntent=>({storyId:'story-1',sceneId:'scene-1',sceneTitle:'At the gate',revision:2,write:sceneRestoreWrite({requestId})})
const scope=()=>({userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'})
const persist=(request:SceneRestoreIntent,writer='earlier-tab')=>{
    const key=novelMutationKey('scene-restore',scope(),sceneRestoreTarget(request),writer)!
    expect(writeNovelMutation(key,request)).toBe(true);return key
}
beforeEach(()=>{
    vi.restoreAllMocks();vi.resetAllMocks();localStorage.clear();mocks.user='restore-author';mocks.workspace='work-one';mocks.story='story-1';mocks.readOnly=false;mocks.authenticated=true
    mocks.data.restoreStoryRevision.mockImplementation(async(_story,_scene,_revision,write)=>sceneRestoreAck(write))
    mocks.data.recoverStoryRevision.mockResolvedValue(null)
    mocks.data.refreshStoryScene.mockResolvedValue({...currentRevisionScene(),revision:4,contentHash:'b'.repeat(64)})
})
it('persists the immutable reviewed request before POST and blocks replacement while uncertain',async()=>{
    const request=intent()
    mocks.data.restoreStoryRevision.mockImplementationOnce(async()=>{
        expect(listSceneRestoreJournals(scope())[0].write).toEqual(request)
        throw new Error('Response lost')
    })
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.start(request).catch(()=>{})})
    request.write.expectedRevision=99
    expect(view.result.current.items[0].write.write.expectedRevision).toBe(3)
    expect(view.result.current.hasPending('scene-1')).toBe(true);expect(view.result.current.hasPending('another-scene')).toBe(false)
    expect(()=>view.result.current.start(intent('new-id'))).toThrow('Recover the pending restore')
    expect(mocks.data.restoreStoryRevision).toHaveBeenCalledTimes(1)
})
it('recovers an original result after reload with one GET and fresh scene read, without another POST',async()=>{
    mocks.data.restoreStoryRevision.mockRejectedValueOnce(new Error('Lost response'))
    const first=renderHook(useRestore)
    await act(async()=>{await first.result.current.start(intent()).catch(()=>{})});first.unmount()
    mocks.data.recoverStoryRevision.mockResolvedValue(sceneRestoreAck())
    const second=renderHook(useRestore)
    await act(async()=>{await second.result.current.recover(second.result.current.items[0])})
    expect(mocks.data.restoreStoryRevision).toHaveBeenCalledTimes(1)
    expect(mocks.data.recoverStoryRevision).toHaveBeenCalledWith('story-1','scene-1',2,sceneRestoreWrite())
    expect(mocks.data.refreshStoryScene).toHaveBeenCalledOnce();expect(second.result.current.items).toEqual([])
    expect(listSceneRestoreJournals(scope())).toEqual([])
})
it('keeps confirmed receipts durable until current prose loads, and retries only that read',async()=>{
    mocks.data.refreshStoryScene.mockRejectedValueOnce(new Error('Read failed'))
    const first=renderHook(useRestore)
    await act(async()=>{expect(await first.result.current.start(intent())).toEqual(sceneRestoreAck())})
    expect(first.result.current.error).toBe('refreshFailed');expect(first.result.current.items[0].write.ack).toEqual(sceneRestoreAck())
    first.unmount();const second=renderHook(useRestore)
    await act(async()=>{await second.result.current.recover(second.result.current.items[0])})
    expect(mocks.data.restoreStoryRevision).toHaveBeenCalledTimes(1);expect(mocks.data.recoverStoryRevision).not.toHaveBeenCalled()
    expect(mocks.data.refreshStoryScene).toHaveBeenCalledTimes(2);expect(second.result.current.items).toEqual([])
})
it.each([{revision:3,contentHash:'c'.repeat(64)},{revision:4,contentHash:'c'.repeat(64)}])('retains recovery when the loaded scene does not match the confirmed head: %j',async(patch)=>{
    mocks.data.refreshStoryScene.mockResolvedValueOnce({...currentRevisionScene(),...patch})
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.start(intent())})
    expect(view.result.current.items[0].write.ack).toEqual(sceneRestoreAck());expect(view.result.current.error).toBe('refreshFailed')
})
it('allows later saved prose after the acknowledgement and does not roll it back to the restored head',async()=>{
    mocks.data.refreshStoryScene.mockResolvedValueOnce({...currentRevisionScene(),revision:5,contentHash:'d'.repeat(64)})
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.start(intent())})
    expect(view.result.current.items).toEqual([]);expect(mocks.data.restoreStoryRevision).toHaveBeenCalledOnce()
})
it('replays only the original request after a null recovery read',async()=>{
    const request=intent();persist(request)
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(mocks.data.restoreStoryRevision).toHaveBeenCalledWith('story-1','scene-1',2,request.write)
    expect(mocks.data.recoverStoryRevision.mock.invocationCallOrder[0]).toBeLessThan(mocks.data.restoreStoryRevision.mock.invocationCallOrder[0])
})
it('retains a missing archived request and still allows receipt-only recovery after it committed',async()=>{
    persist(intent());mocks.readOnly=true
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.recover(view.result.current.items[0]).catch(()=>{})})
    expect(view.result.current.error).toBe('readOnly');expect(view.result.current.items).toHaveLength(1);expect(mocks.data.restoreStoryRevision).not.toHaveBeenCalled()
    mocks.data.recoverStoryRevision.mockResolvedValue(sceneRestoreAck())
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([]);expect(mocks.data.refreshStoryScene).toHaveBeenCalledOnce()
})
it('keeps a late result in its original account/workspace and never hydrates the new owner',async()=>{
    let finish!:(value:ReturnType<typeof sceneRestoreAck>)=>void
    mocks.data.restoreStoryRevision.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(useRestore),oldStart=view.result.current.start;let pending!:ReturnType<typeof oldStart>
    act(()=>{pending=oldStart(intent())})
    mocks.user='other-author';mocks.workspace='work-two';view.rerender()
    await act(async()=>{finish(sceneRestoreAck());await pending;expect(await oldStart(intent('stale-handler'))).toBeNull()})
    expect(view.result.current.items).toEqual([]);expect(mocks.data.refreshStoryScene).not.toHaveBeenCalled()
    expect(listSceneRestoreJournals(scope())).toEqual([])
    mocks.user='restore-author';mocks.workspace='work-one';view.rerender()
    expect(view.result.current.items[0].write.ack).toEqual(sceneRestoreAck())
})
it('does not retry a missing result if scope changes during the recovery read',async()=>{
    persist(intent());let finish!:(value:null)=>void
    mocks.data.recoverStoryRevision.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(useRestore);let pending!:ReturnType<typeof view.result.current.recover>
    act(()=>{pending=view.result.current.recover(view.result.current.items[0])})
    mocks.user='other-author';mocks.workspace='work-two';view.rerender()
    await act(async()=>{finish(null);await pending})
    expect(mocks.data.restoreStoryRevision).not.toHaveBeenCalled();expect(mocks.data.refreshStoryScene).not.toHaveBeenCalled()
})
it('retires only the acknowledged request and preserves another writer arriving during recovery',async()=>{
    const key=persist(intent());let finish!:(value:ReturnType<typeof sceneRestoreAck>)=>void
    mocks.data.recoverStoryRevision.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(useRestore);let pending!:ReturnType<typeof view.result.current.recover>
    act(()=>{pending=view.result.current.recover(view.result.current.items[0])})
    const newer=intent('newer-tab'),newKey=persist(newer,'other-tab')
    act(()=>window.dispatchEvent(new Event('storage')))
    await act(async()=>{finish(sceneRestoreAck());await pending})
    expect(localStorage.getItem(key)).toBeNull();expect(localStorage.getItem(newKey)).not.toBeNull()
    expect(view.result.current.items.map((record)=>record.write.write.requestId)).toEqual(['newer-tab'])
})
it('keeps uncertain requests in memory when device storage fails and can still recover them',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    mocks.data.restoreStoryRevision.mockRejectedValueOnce(new Error('Offline'))
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.start(intent()).catch(()=>{})})
    expect(view.result.current.items[0].storageFailed).toBe(true)
    mocks.data.recoverStoryRevision.mockResolvedValue(sceneRestoreAck())
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([]);expect(mocks.data.restoreStoryRevision).toHaveBeenCalledTimes(1)
})
it.each([409,422,404])('retires definite rejection %s and requires a fresh review',async(status)=>{
    mocks.data.restoreStoryRevision.mockRejectedValueOnce(new ApiError(status,'Changed',{code:'STORY_REVISION_CONFLICT'}))
    const view=renderHook(useRestore)
    await act(async()=>{await view.result.current.start(intent()).catch(()=>{})})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.error).toBe('changed')
})
