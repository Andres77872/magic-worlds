import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError,type ApiService } from '@/infrastructure/api'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { noteAck,noteAnchor,noteWrite,personalNote } from '@/test/fixtures/storyAnnotations'
import { currentRevisionScene,sceneRevision } from '@/test/fixtures/storyRevisions'
import type { StoryAnnotationWrite } from '@/shared'
import { annotationTarget,listAnnotationJournals,type AnnotationIntent } from '../persistence/annotationJournal'
const mocks=vi.hoisted(()=>({user:'note-author',workspace:'work-one',readOnly:false,authenticated:true,login:vi.fn(),api:{changeStoryAnnotation:vi.fn(),getStoryAnnotationResult:vi.fn(),getStoryAnnotation:vi.fn(),getStoryRevision:vi.fn()}}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:mocks.user,isAuthenticated:mocks.authenticated,openLoginModal:mocks.login})}))
import { useAnnotationMutations } from './useAnnotationMutations'
const one={workspaceId:'work-one',isCurrent:()=>mocks.user==='note-author'&&mocks.workspace==='work-one',detachedApi:()=>mocks.api as unknown as ApiService}
const two={workspaceId:'work-two',isCurrent:()=>mocks.user==='other-author'&&mocks.workspace==='work-two',detachedApi:()=>mocks.api as unknown as ApiService}
const scope=()=>({userHash:mocks.user,workspaceId:mocks.workspace,storyId:'story-1'})
const current=()=>personalNote({revision:1,anchorVersion:1,body:'Keep this note.',origin:noteAnchor()})
const useNotes=()=>useAnnotationMutations('story-1',mocks.workspace==='work-one'?one:two,mocks.readOnly)
const persist=()=>{
    const request:AnnotationIntent={storyId:'story-1',write:noteWrite()},key=novelMutationKey('annotation',scope(),annotationTarget(request),'older-tab')!
    writeNovelMutation(key,request);return key
}
beforeEach(()=>{
    vi.restoreAllMocks();vi.resetAllMocks();localStorage.clear();mocks.user='note-author';mocks.workspace='work-one';mocks.readOnly=false;mocks.authenticated=true
    mocks.api.changeStoryAnnotation.mockImplementation(async(_story,write)=>noteAck(write));mocks.api.getStoryAnnotationResult.mockResolvedValue(null);mocks.api.getStoryAnnotation.mockResolvedValue(current())
})
it('persists the immutable note request before POST and blocks replacement of that note while uncertain',async()=>{
    const write=noteWrite()
    mocks.api.changeStoryAnnotation.mockImplementationOnce(async()=>{expect(listAnnotationJournals(scope())[0].write.write).toEqual(write);throw new Error('Lost response')})
    const view=renderHook(useNotes)
    await act(async()=>{await view.result.current.start(write).catch(()=>{})})
    if(write.operation.op==='create')write.operation.body='New local text'
    expect(view.result.current.items[0].write.write).toEqual(noteWrite())
    expect(()=>view.result.current.start(noteWrite())).toThrow('Recover this note')
})
it('recovers a committed note after reload using its exact receipt before any retry',async()=>{
    mocks.api.changeStoryAnnotation.mockRejectedValueOnce(new Error('Lost response'))
    const first=renderHook(useNotes)
    await act(async()=>{await first.result.current.start(noteWrite()).catch(()=>{})});first.unmount()
    mocks.api.getStoryAnnotationResult.mockResolvedValue(noteAck())
    const next=renderHook(useNotes)
    await act(async()=>{expect(await next.result.current.recover(next.result.current.items[0])).toEqual(current())})
    expect(mocks.api.changeStoryAnnotation).toHaveBeenCalledTimes(1);expect(mocks.api.getStoryAnnotationResult).toHaveBeenCalledWith('story-1',noteWrite())
    expect(next.result.current.items).toEqual([])
})
it('retains a confirmed receipt after hydration fails and retries only the read',async()=>{
    mocks.api.getStoryAnnotation.mockRejectedValueOnce(new Error('Read unavailable'))
    const first=renderHook(useNotes)
    await act(async()=>{expect(await first.result.current.start(noteWrite())).toBeNull()})
    expect(first.result.current.items[0].write.ack).toEqual(noteAck());expect(first.result.current.error).toBe('refreshFailed')
    first.unmount();const next=renderHook(useNotes)
    await act(async()=>{await next.result.current.recover(next.result.current.items[0])})
    expect(mocks.api.changeStoryAnnotation).toHaveBeenCalledTimes(1);expect(mocks.api.getStoryAnnotationResult).not.toHaveBeenCalled();expect(next.result.current.items).toEqual([])
})
it('does not retire confirmation when a same-version read changes the submitted note body',async()=>{
    mocks.api.getStoryAnnotation.mockResolvedValueOnce(personalNote({revision:1,anchorVersion:1,body:'Wrong saved text'}))
    const view=renderHook(useNotes)
    await act(async()=>{await view.result.current.start(noteWrite())})
    expect(view.result.current.error).toBe('refreshFailed');expect(view.result.current.items[0].write.ack).toEqual(noteAck())
})
it('accepts later independent body and anchor versions without replaying an old note edit',async()=>{
    persist();mocks.api.getStoryAnnotationResult.mockResolvedValue(noteAck());mocks.api.getStoryAnnotation.mockResolvedValue(personalNote({revision:4,anchorVersion:6,body:'Later author note'}))
    const view=renderHook(useNotes)
    await act(async()=>{expect((await view.result.current.recover(view.result.current.items[0]))?.body).toBe('Later author note')})
    expect(mocks.api.changeStoryAnnotation).not.toHaveBeenCalled();expect(view.result.current.items).toEqual([])
})
it('permits archived receipt reads and never POSTs an unconfirmed archived request',async()=>{
    persist();mocks.readOnly=true;const view=renderHook(useNotes)
    await act(async()=>{await view.result.current.recover(view.result.current.items[0]).catch(()=>{})})
    expect(view.result.current.error).toBe('readOnly');expect(view.result.current.items).toHaveLength(1);expect(mocks.api.changeStoryAnnotation).not.toHaveBeenCalled()
    mocks.api.getStoryAnnotationResult.mockResolvedValue(noteAck())
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([])
})
it('keeps a late acknowledgement in its original owner and never hydrates another account',async()=>{
    let finish!:(value:ReturnType<typeof noteAck>)=>void;mocks.api.changeStoryAnnotation.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=renderHook(useNotes),oldStart=view.result.current.start;let pending!:ReturnType<typeof oldStart>
    act(()=>{pending=oldStart(noteWrite())})
    mocks.user='other-author';mocks.workspace='work-two';view.rerender()
    await act(async()=>{finish(noteAck());await pending;expect(await oldStart(noteWrite())).toBeNull()})
    expect(view.result.current.items).toEqual([]);expect(mocks.api.getStoryAnnotation).not.toHaveBeenCalled()
    mocks.user='note-author';mocks.workspace='work-one';view.rerender();expect(view.result.current.items[0].write.ack).toEqual(noteAck())
})
it('retains in-memory recovery if device storage fails',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')});mocks.api.changeStoryAnnotation.mockRejectedValueOnce(new Error('Offline'))
    const view=renderHook(useNotes)
    await act(async()=>{await view.result.current.start(noteWrite()).catch(()=>{})})
    expect(view.result.current.items[0].storageFailed).toBe(true)
    mocks.api.getStoryAnnotationResult.mockResolvedValue(noteAck())
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])});expect(view.result.current.items).toEqual([])
})
it('retires a definite version conflict while keeping error state for explicit review',async()=>{
    mocks.api.changeStoryAnnotation.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_ANNOTATION_ANCHOR_CONFLICT'}))
    const view=renderHook(useNotes)
    await act(async()=>{await view.result.current.start(noteWrite()).catch(()=>{})})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.error).toBe('changed')
})

it('retains a bookmark receipt until its exact checkpoint point verifies, then recovers without another POST',async()=>{
    const point=noteAnchor({quote:'',start:{nodeId:'current-gate',offset:0},end:{nodeId:'current-gate',offset:0}})
    const write:StoryAnnotationWrite={requestId:'bookmark-recovery',operation:{op:'create',kind:'bookmark',id:'bookmark-1',body:'Return here',anchor:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:0,quote:''}}}
    const saved=personalNote({id:'bookmark-1',kind:'bookmark',body:'Return here',revision:1,anchorVersion:1,origin:point,anchor:point,lastAnchor:point})
    mocks.api.getStoryAnnotation.mockResolvedValue(saved)
    mocks.api.getStoryRevision.mockRejectedValueOnce(new Error('Checkpoint unavailable')).mockResolvedValue(sceneRevision({revision:3,contentHash:'c'.repeat(64),document:currentRevisionScene().document}))
    const view=renderHook(useNotes)
    await act(async()=>expect(await view.result.current.start(write)).toBeNull())
    expect(view.result.current.items[0].write.ack).toEqual(noteAck(write));expect(view.result.current.error).toBe('refreshFailed');expect(view.result.current.errorKind).toBe('bookmark')
    await act(async()=>expect(await view.result.current.recover(view.result.current.items[0])).toEqual(saved))
    expect(mocks.api.changeStoryAnnotation).toHaveBeenCalledOnce();expect(mocks.api.getStoryAnnotationResult).not.toHaveBeenCalled()
    expect(mocks.api.getStoryRevision).toHaveBeenCalledTimes(2);expect(view.result.current.items).toEqual([])
})
