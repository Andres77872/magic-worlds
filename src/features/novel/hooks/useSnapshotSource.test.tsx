import { renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
const data=vi.hoisted(()=>({refreshStory:vi.fn()})),refresh=data.refreshStory
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'snapshot-author'}),useData:()=>data}))
import { useSnapshotSource } from './useSnapshotSource'
beforeEach(()=>{vi.clearAllMocks();data.refreshStory=refresh;refresh.mockResolvedValue(null)})
it('refreshes the saved manuscript before reading the source used by capture',async()=>{
    const preview=vi.fn().mockResolvedValue({sourceVersion:'version'})
    const workspace={workspaceId:'workspace-one',isCurrent:()=>true,detachedApi:()=>({getStorySnapshotPreview:preview} as unknown as ApiService)}
    const {result}=renderHook(()=>useSnapshotSource('story-1',workspace))
    expect(result.current?.key).toBe('snapshot-author:workspace-one:story-1')
    await result.current!.preview()
    expect(refresh).toHaveBeenCalledWith('story-1')
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(preview.mock.invocationCallOrder[0])
})
it('starts no preview read if the account or workspace changes during manuscript refresh',async()=>{
    let current=true,finish!:(value:null)=>void
    refresh.mockImplementation(()=>new Promise<null>((resolve)=>{finish=resolve}))
    const preview=vi.fn()
    const workspace={workspaceId:'workspace-one',isCurrent:()=>current,detachedApi:()=>({getStorySnapshotPreview:preview} as unknown as ApiService)}
    const {result}=renderHook(()=>useSnapshotSource('story-1',workspace))
    const pending=result.current!.preview();current=false;finish(null)
    await expect(pending).rejects.toThrow('Snapshot scope changed')
    expect(preview).not.toHaveBeenCalled()
})
it('refreshes the current source before preparing an owned restore with exact options',async()=>{
    const restore=vi.fn().mockResolvedValue({snapshotId:3})
    const workspace={workspaceId:'workspace-one',isCurrent:()=>true,detachedApi:()=>({previewStorySnapshotRestore:restore} as unknown as ApiService)}
    const {result}=renderHook(()=>useSnapshotSource('story-1',workspace))
    const options={text:true,details:false,organization:true,context:true,laterUnits:'keep' as const}
    await result.current!.restorePreview(3,options)
    expect(refresh).toHaveBeenCalledWith('story-1');expect(restore).toHaveBeenCalledWith('story-1',3,options)
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(restore.mock.invocationCallOrder[0])
})
it('keeps an in-flight preview source stable when a provider cache refresh replaces its callback',async()=>{
    let finish!:(value:null)=>void
    refresh.mockImplementationOnce(()=>new Promise<null>((resolve)=>{finish=resolve}))
    const preview=vi.fn().mockResolvedValue({sourceVersion:'version'})
    const workspace={workspaceId:'workspace-one',isCurrent:()=>true,detachedApi:()=>({getStorySnapshotPreview:preview} as unknown as ApiService)}
    const view=renderHook(()=>useSnapshotSource('story-1',workspace)),source=view.result.current!
    const pending=source.preview(),replacement=vi.fn().mockResolvedValue(null)
    data.refreshStory=replacement;view.rerender()
    expect(view.result.current).toBe(source)
    finish(null);await pending;expect(preview).toHaveBeenCalledOnce()
    await source.preview();expect(replacement).toHaveBeenCalledWith('story-1');expect(refresh).toHaveBeenCalledOnce()
})
