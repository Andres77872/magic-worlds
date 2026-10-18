import { renderHook } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { currentRevisionScene,revisionPage,sceneRevision } from '@/test/fixtures/storyRevisions'
const data=vi.hoisted(()=>({refreshStoryScene:vi.fn()})),refresh=data.refreshStoryScene
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'scene-author'}),useData:()=>data}))
import { useSceneRevisionSource } from './useSceneRevisionSource'
beforeEach(()=>{vi.clearAllMocks();data.refreshStoryScene=refresh;refresh.mockResolvedValue(currentRevisionScene())})
it('uses metadata-only head queries and loads only one owned checkpoint/current scene',async()=>{
    const page=vi.fn().mockResolvedValue(revisionPage()),detail=vi.fn().mockResolvedValue(sceneRevision())
    const workspace={workspaceId:'work-one',isCurrent:()=>true,detachedApi:()=>({getStoryRevisions:page,getStoryRevision:detail} as unknown as ApiService)}
    const {result}=renderHook(()=>useSceneRevisionSource('story-1','scene-1',workspace)),source=result.current!
    await source.detail(2,'b'.repeat(64));await source.head();await source.current()
    expect(detail).toHaveBeenCalledWith('story-1','scene-1',2,'b'.repeat(64))
    expect(page).toHaveBeenCalledWith('story-1','scene-1',{before:1})
    expect(refresh).toHaveBeenCalledWith('story-1','scene-1')
})
it('retains source identity across provider renders and uses the latest refresh callback',async()=>{
    let finish!:(value:ReturnType<typeof currentRevisionScene>)=>void
    refresh.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const workspace={workspaceId:'work-one',isCurrent:()=>true,detachedApi:()=>({} as ApiService)}
    const view=renderHook(()=>useSceneRevisionSource('story-1','scene-1',workspace)),source=view.result.current!,pending=source.current()
    const replacement=vi.fn().mockResolvedValue(currentRevisionScene());data.refreshStoryScene=replacement;view.rerender()
    expect(view.result.current).toBe(source)
    finish(currentRevisionScene());await pending;await source.current()
    expect(replacement).toHaveBeenCalledWith('story-1','scene-1');expect(refresh).toHaveBeenCalledOnce()
})
it('starts no reads after ownership changes and rejects late current text from the old scope',async()=>{
    let current=true,finish!:(value:ReturnType<typeof currentRevisionScene>)=>void
    refresh.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const page=vi.fn(),workspace={workspaceId:'work-one',isCurrent:()=>current,detachedApi:()=>({getStoryRevisions:page} as unknown as ApiService)}
    const {result}=renderHook(()=>useSceneRevisionSource('story-1','scene-1',workspace)),source=result.current!,pending=source.current()
    current=false;finish(currentRevisionScene());await expect(pending).rejects.toThrow('scope changed')
    expect(()=>source.page({})).toThrow('scope changed');expect(page).not.toHaveBeenCalled()
})
