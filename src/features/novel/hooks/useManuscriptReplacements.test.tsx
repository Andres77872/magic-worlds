import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
import { replacementAck,replacementPreview } from '@/test/fixtures/storyReplacement'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { listReplacementJournals,replacementIntent,type ReplacementIntent } from '../persistence/replacementJournal'
import type { ManuscriptReplacementSource } from './useManuscriptReplacementSource'
const auth=vi.hoisted(()=>({userHash:'replace-author',isAuthenticated:true,openLoginModal:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
import { replacementError,useManuscriptReplacements } from './useManuscriptReplacements'
let source:ManuscriptReplacementSource,readOnly:boolean
const scope=()=>({userHash:auth.userHash,workspaceId:'desk',storyId:'story-1'})
const confirmedStory=()=>{const story=novel();story.chapters[0].scenes[0].id='scene-1';story.chapters[0].scenes[0].revision=2;story.chapters[0].scenes[0].contentHash='d'.repeat(64);return story}
const mount=()=>renderHook(()=>useManuscriptReplacements(source,'desk',readOnly))
const persist=(value:ReplacementIntent,writer='earlier-tab')=>{const key=novelMutationKey('manuscript-replace',scope(),value.write.requestId,writer)!;expect(writeNovelMutation(key,value)).toBe(true);return key}
it.each(['STORY_REPLACE_ORIGIN_NOT_FOUND','STORY_REVISION_CHECKPOINT_MISSING'])('reports unavailable reversal evidence explicitly: %s',(code)=>{
    expect(replacementError(new ApiError(404,'Missing',{code}))).toBe('originUnavailable')
})
it('asks for a smaller selection when a bounded review is too large',()=>{
    expect(replacementError(new ApiError(422,'Too large',{code:'STORY_REPLACE_REVIEW_TOO_LARGE'}))).toBe('reviewLimit')
})
beforeEach(()=>{
    vi.restoreAllMocks();vi.clearAllMocks();localStorage.clear();auth.userHash='replace-author';auth.isAuthenticated=true;readOnly=false
    source={key:'owned',storyId:'story-1',isCurrent:()=>true,preview:vi.fn(),reverse:vi.fn(),write:vi.fn(async(write)=>replacementAck(write)),recover:vi.fn(async()=>null),refresh:vi.fn(async()=>confirmedStory())}
})
it('journals immutable reviewed heads before writing and blocks replacement while the result is uncertain',async()=>{
    vi.mocked(source.write).mockImplementationOnce(async(write)=>{expect(listReplacementJournals(scope())[0].write.write).toEqual(write);throw new Error('Lost response')})
    const view=mount(),review=replacementPreview()
    await act(async()=>{await view.result.current.start(review).catch(()=>{})})
    review.scenes[0].revision=90
    expect(view.result.current.items[0].write.heads[0].revision).toBe(1)
    expect(view.result.current.hasPending('scene-1')).toBe(true);expect(view.result.current.hasPending('other')).toBe(false)
    expect(()=>view.result.current.start(replacementPreview())).toThrow('Recover the pending replacement')
})
it('recovers the original receipt after reload, without another mutation or a draft-flush barrier',async()=>{
    vi.mocked(source.write).mockRejectedValueOnce(new Error('Lost response'))
    const first=mount();await act(async()=>{await first.result.current.start(replacementPreview()).catch(()=>{})})
    const write=first.result.current.items[0].write.write;first.unmount()
    vi.mocked(source.recover).mockResolvedValue(replacementAck(write))
    const next=mount();await act(async()=>{await next.result.current.recover(next.result.current.items[0])})
    expect(source.write).toHaveBeenCalledTimes(1);expect(source.recover).toHaveBeenCalledWith(write);expect(source.refresh).toHaveBeenCalledOnce()
    expect(next.result.current.items).toEqual([]);expect(listReplacementJournals(scope())).toEqual([])
    expect(next.result.current.history[0].originRequestId).toBe(write.requestId)
})
it('retains a confirmed receipt on failed hydration and retries only the owned read',async()=>{
    vi.mocked(source.refresh).mockRejectedValueOnce(new Error('Read unavailable'))
    const first=mount();await act(async()=>{await first.result.current.start(replacementPreview())})
    expect(first.result.current.error).toBe('refreshFailed');expect(first.result.current.items[0].write.ack).toBeDefined()
    first.unmount();const next=mount();await act(async()=>{await next.result.current.recover(next.result.current.items[0])})
    expect(source.write).toHaveBeenCalledOnce();expect(source.recover).not.toHaveBeenCalled();expect(source.refresh).toHaveBeenCalledTimes(2);expect(next.result.current.items).toEqual([])
})
it('requires every confirmed head, allows later saved prose, and rejects a different exact-revision hash',async()=>{
    const stale=confirmedStory();stale.chapters[0].scenes[0].contentHash='e'.repeat(64)
    vi.mocked(source.refresh).mockResolvedValueOnce(stale)
    const view=mount();await act(async()=>{await view.result.current.start(replacementPreview())})
    expect(view.result.current.error).toBe('refreshFailed');expect(view.result.current.hasPending()).toBe(true)
    stale.chapters[0].scenes[0].revision=3
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([]);expect(source.write).toHaveBeenCalledOnce()
})
it('retries exactly the original intent only after a missing receipt and refuses an archived unapplied retry',async()=>{
    const value=replacementIntent(replacementPreview(),'original');persist(value);readOnly=true
    const view=mount();await act(async()=>{await view.result.current.recover(view.result.current.items[0]).catch(()=>{})})
    expect(source.recover).toHaveBeenCalledWith(value.write);expect(source.write).not.toHaveBeenCalled();expect(view.result.current.items).toHaveLength(1)
    readOnly=false;view.rerender();await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(source.write).toHaveBeenCalledWith(value.write);expect(view.result.current.items).toEqual([])
})
it('retains uncertain and malformed results but retires a definite atomic rejection',async()=>{
    vi.mocked(source.write).mockImplementationOnce(async(write)=>({...replacementAck(write),scenes:[]}))
    const view=mount();await act(async()=>{await view.result.current.start(replacementPreview()).catch(()=>{})})
    expect(view.result.current.error).toBe('contract');expect(view.result.current.hasPending()).toBe(true)
    vi.mocked(source.recover).mockResolvedValue(null)
    vi.mocked(source.write).mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_REPLACE_SOURCE_CHANGED'}))
    await act(async()=>{await view.result.current.recover(view.result.current.items[0]).catch(()=>{})})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.error).toBe('changed')
})
it('keeps a late acknowledgement with its original owner and never refreshes a new owner',async()=>{
    let finish!:(value:ReturnType<typeof replacementAck>)=>void
    const original=source;vi.mocked(source.write).mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=mount();let pending!:ReturnType<typeof view.result.current.start>
    act(()=>{pending=view.result.current.start(replacementPreview())})
    const write=view.result.current.items[0].write.write
    source={...source,key:'other',isCurrent:()=>true};auth.userHash='other-author';view.rerender()
    await act(async()=>{finish(replacementAck(write));await pending})
    expect(original.refresh).not.toHaveBeenCalled();expect(view.result.current.items).toEqual([])
    auth.userHash='replace-author';source=original;view.rerender()
    expect(view.result.current.items[0].write.ack).toEqual(replacementAck(write))
})
it('retains memory recovery when storage is unavailable',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    vi.mocked(source.write).mockRejectedValueOnce(new Error('Offline'))
    const view=mount();await act(async()=>{await view.result.current.start(replacementPreview()).catch(()=>{})})
    expect(view.result.current.items[0].storageFailed).toBe(true)
    const write=view.result.current.items[0].write.write
    vi.mocked(source.recover).mockResolvedValue(replacementAck(write))
    await act(async()=>{await view.result.current.recover(view.result.current.items[0])})
    expect(view.result.current.items).toEqual([]);expect(view.result.current.historyStorageFailed).toBe(true)
})
it('retains unfinished multiline form input, offers explicit recovery, and separates account scope',()=>{
    const first=mount()
    act(()=>first.result.current.form.update({q:'  ',replacement:'first\nsecond',scope:'scene:scene-1'}));first.unmount()
    const next=mount();expect(next.result.current.form.form.q).toBe('');expect(next.result.current.form.recovery?.write.replacement).toBe('first\nsecond')
    act(()=>next.result.current.form.resume());expect(next.result.current.form.form).toMatchObject({q:'  ',replacement:'first\nsecond'})
    auth.userHash='another';source={...source,key:'another'};next.rerender();expect(next.result.current.form.recovery).toBeNull();expect(next.result.current.form.form.q).toBe('')
})
