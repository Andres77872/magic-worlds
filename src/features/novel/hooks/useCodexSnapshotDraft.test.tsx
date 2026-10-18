import { act,renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { storyReference } from '@/test/fixtures/story'
import type { CodexEntry } from './useCodex'
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'snapshot-author'})}))
import { useCodexSnapshotDraft } from './useCodexSnapshotDraft'
const entry:CodexEntry={id:'reference-1',kind:'character',label:'Mira',description:'Original description',enabled:true,ref:storyReference(),contextRevision:2}
beforeEach(()=>localStorage.clear())
it('retains final private snapshot edits across closing and explicitly resumes them',()=>{
    const first=renderHook(()=>useCodexSnapshotDraft(entry,'work-one',false))
    act(()=>{first.result.current.edit('description','Unsent private notes')})
    first.unmount()
    const second=renderHook(()=>useCodexSnapshotDraft(entry,'work-one',false))
    expect(second.result.current.form.description).toBe(entry.description)
    expect(second.result.current.recovery?.write.form.description).toBe('Unsent private notes')
    act(()=>{second.result.current.resume()})
    expect(second.result.current.form.description).toBe('Unsent private notes')
    act(()=>{second.result.current.acknowledged()})
    second.unmount()
    expect(Object.keys(localStorage).filter((key)=>key.includes('novel-codex-details:'))).toEqual([])
})
it('keeps the original revision until an explicit field-wise rebase and preserves unrelated account edits',()=>{
    const view=renderHook(({current})=>useCodexSnapshotDraft(current,'work-one',false),{initialProps:{current:entry}})
    act(()=>{view.result.current.edit('description','My private revision')})
    view.rerender({current:{...entry,label:'Renamed elsewhere',contextRevision:4}})
    expect(view.result.current.baseRevision).toBe(2)
    expect(view.result.current.remoteChanged).toBe(true)
    act(()=>{view.result.current.resolve(true)})
    expect(view.result.current.form).toEqual({label:'Renamed elsewhere',description:'My private revision'})
    expect(view.result.current.baseRevision).toBe(4)
})
it('does not edit read-only snapshots or leak a journal into another workspace',()=>{
    const first=renderHook(()=>useCodexSnapshotDraft(entry,'work-one',false))
    act(()=>{first.result.current.edit('label','Private name')})
    first.unmount()
    const other=renderHook(()=>useCodexSnapshotDraft(entry,'work-two',true))
    expect(other.result.current.recovery).toBeNull()
    act(()=>{other.result.current.edit('label','Forbidden')})
    expect(other.result.current.form.label).toBe(entry.label)
})
