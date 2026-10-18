import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { novelMutationKey,writeNovelMutation } from '@/shared/novelMutationJournal'
import { noteWrite } from '@/test/fixtures/storyAnnotations'
import type { AnnotationDraft } from '../persistence/annotationJournal'
const auth=vi.hoisted(()=>({userHash:'note-author'}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
import { useAnnotationDrafts } from './useAnnotationDrafts'
const workspace={workspaceId:'work-one',isCurrent:()=>auth.userHash==='note-author',detachedApi:()=>null}
const draft=():AnnotationDraft=>{
    const write=noteWrite();if(write.operation.op!=='create')throw new Error('Fixture')
    return {storyId:'story-1',annotationId:'note-1',body:'Keep this note.',sequence:1,mode:'create',selection:write.operation.anchor,baseRevision:null,originalBody:null}
}
beforeEach(()=>{vi.restoreAllMocks();localStorage.clear();auth.userHash='note-author'})
it('retains the final keystroke after closure and offers another writer for explicit recovery',()=>{
    const first=renderHook(()=>useAnnotationDrafts('story-1',workspace));act(()=>{first.result.current.save(draft())});first.unmount()
    const next=renderHook(()=>useAnnotationDrafts('story-1',workspace));expect(next.result.current.items[0].write.body).toBe('Keep this note.')
})
it('retires only the exact draft bound to a confirmed request and preserves newer input',()=>{
    const view=renderHook(()=>useAnnotationDrafts('story-1',workspace));let original!:NonNullable<ReturnType<typeof view.result.current.save>>
    act(()=>{original=view.result.current.save(draft())!;view.result.current.save({...draft(),body:'Newer local note.',sequence:2},original)})
    act(()=>view.result.current.confirm({storyId:'story-1',write:noteWrite(),draft:original}))
    expect(view.result.current.items[0].write.body).toBe('Newer local note.')
})
it('does not erase a different writer or account even when note content is identical',()=>{
    const other=novelMutationKey('annotation-draft',{userHash:'another-author',workspaceId:'work-one',storyId:'story-1'},'note-1','foreign-tab')!
    writeNovelMutation(other,draft())
    const view=renderHook(()=>useAnnotationDrafts('story-1',workspace))
    act(()=>view.result.current.confirm({storyId:'story-1',write:noteWrite(),draft:{schema:1,write:draft(),storageKey:other}}))
    expect(localStorage.getItem(other)).not.toBeNull();expect(view.result.current.items).toEqual([])
})
it('keeps unsent note text in memory with a visible storage failure',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    const view=renderHook(()=>useAnnotationDrafts('story-1',workspace));act(()=>{view.result.current.save(draft())})
    expect(view.result.current.items[0].storageFailed).toBe(true)
    const record=view.result.current.items[0];act(()=>view.result.current.confirm({storyId:'story-1',write:noteWrite(),draft:record}));expect(view.result.current.items).toEqual([])
})
