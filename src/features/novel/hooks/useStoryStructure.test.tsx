import { act,renderHook } from '@testing-library/react'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
const change=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn().mockResolvedValue(undefined))
const recover=vi.hoisted(()=>vi.fn().mockResolvedValue(null))
vi.mock('@/app/hooks',()=>({useData:()=>({changeStoryStructure:change,recoverStoryStructure:recover,refreshStory:refresh}),useAuth:()=>({userHash:'structure-author',isAuthenticated:true,openLoginModal:vi.fn()})}))
import { useStoryStructure } from './useStoryStructure'
const story=novel()
const operation={op:'create' as const,kind:'chapter' as const,title:'Two'}
const workspace={workspaceId:'workspace-one',isCurrent:()=>true,detachedApi:()=>null}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();recover.mockResolvedValue(null)})
describe('durable organization requests',()=>{
    it('retries exactly the original write after an uncertain response and prevents another operation',async()=>{
        change.mockRejectedValueOnce(new ApiError(503,'Connection interrupted',{retryable:true})).mockResolvedValueOnce({structureRevision:2,selectedId:'new',story})
        const select=vi.fn()
        const {result}=renderHook(()=>useStoryStructure(story,workspace,false,select))
        await act(async()=>{await result.current.perform(operation)})
        const write=change.mock.calls[0][1]
        expect(result.current.pending?.write).toEqual(write)
        expect(Object.keys(localStorage).some((key)=>key.includes('novel-structure'))).toBe(true)
        await act(async()=>{await result.current.perform({...operation,title:'Different'})})
        expect(change).toHaveBeenCalledTimes(1)
        await act(async()=>{await result.current.retry()})
        expect(change.mock.calls[1][1]).toEqual(write)
        expect(select).toHaveBeenCalledWith('new',story)
        expect(result.current.pending).toBeNull()
        expect(Object.keys(localStorage).some((key)=>key.includes('novel-structure'))).toBe(false)
    })
    it('recovers an unfinished request when the novel is reopened',async()=>{
        change.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({structureRevision:2,selectedId:'new',story})
        const first=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        await act(async()=>{await first.result.current.perform(operation)})
        const original=change.mock.calls[0][1]
        first.unmount()
        const second=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        expect(second.result.current.pending?.write).toEqual(original)
        await act(async()=>{await second.result.current.retry()})
        expect(change.mock.calls[1][1]).toEqual(original)
    })
    it('refreshes after a definite conflict and retains no uncertain operation',async()=>{
        change.mockRejectedValueOnce(new ApiError(409,'Stale outline',{code:'STORY_STRUCTURE_CONFLICT'}))
        const {result}=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        await act(async()=>{await result.current.perform(operation)})
        expect(refresh).toHaveBeenCalledWith(story.id)
        expect(result.current.pending).toBeNull()
        expect(result.current.error).toBe('STORY_STRUCTURE_CONFLICT')
    })
    it('drops a late selection change after switching novels and keeps its acknowledgement isolated',async()=>{
        let finish!:(value:unknown)=>void
        change.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
        const select=vi.fn()
        const {result,rerender}=renderHook(({current})=>useStoryStructure(current,workspace,false,select),{initialProps:{current:story}})
        let pending!:Promise<unknown>
        act(()=>{pending=result.current.perform(operation)})
        rerender({current:novel({id:'other-story'})})
        await act(async()=>{finish({structureRevision:2,selectedId:'old-scene',story});await pending})
        expect(select).not.toHaveBeenCalled()
        expect(result.current.pending).toBeNull()
    })
    it('starts no write in an archived workspace',async()=>{
        const {result}=renderHook(()=>useStoryStructure(story,workspace,true,vi.fn()))
        await act(async()=>{await result.current.perform(operation)})
        expect(change).not.toHaveBeenCalled()
    })
    it('reads an acknowledged structure result after reload and archive without a second write',async()=>{
        change.mockRejectedValueOnce(new Error('Response lost'))
        const first=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        await act(async()=>{await first.result.current.perform(operation)})
        const write=change.mock.calls[0][1];first.unmount()
        recover.mockResolvedValueOnce({structureRevision:2,selectedId:'new',story})
        const select=vi.fn(),second=renderHook(()=>useStoryStructure(story,workspace,true,select))
        await act(async()=>{await second.result.current.retry()})
        expect(recover).toHaveBeenCalledWith(story.id,write)
        expect(change).toHaveBeenCalledTimes(1)
        expect(select).toHaveBeenCalledWith('new',story)
        expect(second.result.current.pending).toBeNull()
    })
    it('retains an absent result while archived and freezes nested copy options across retries',async()=>{
        const copy={op:'duplicate' as const,kind:'scene' as const,id:'scene-1',title:'A copy',sourceStructureRevision:1,expectedMetadataRevision:1,expectedContextRevision:1,
            sourceScenes:[{id:'scene-1',revision:1,metadataRevision:1}],options:{includeNotes:true,includeContext:true,includeArchived:false,includeTrash:false}}
        change.mockRejectedValueOnce(new Error('Response lost'))
        const first=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        await act(async()=>{await first.result.current.perform(copy)})
        copy.options.includeNotes=false;copy.sourceScenes[0].revision=9
        const original=change.mock.calls[0][1]
        expect(first.result.current.pending?.write.operation).toMatchObject({options:{includeNotes:true},sourceScenes:[{id:'scene-1',revision:1,metadataRevision:1}]})
        first.unmount()
        const second=renderHook(()=>useStoryStructure(story,workspace,true,vi.fn()))
        await act(async()=>{await second.result.current.retry()})
        expect(change).toHaveBeenCalledTimes(1)
        expect(second.result.current.pending?.write).toEqual(original)
        expect(second.result.current.error).toBe('WORKSPACE_ARCHIVED')
    })
    it('does not POST again when recovery confirms a request but its manuscript read fails',async()=>{
        change.mockRejectedValueOnce(new Error('Response lost'))
        const view=renderHook(()=>useStoryStructure(story,workspace,false,vi.fn()))
        await act(async()=>{await view.result.current.perform(operation)})
        const write=change.mock.calls[0][1]
        recover.mockRejectedValueOnce(new Error('Reader unavailable'))
        await act(async()=>{await view.result.current.retry()})
        expect(change).toHaveBeenCalledTimes(1)
        expect(view.result.current.pending?.write).toEqual(write)
    })
})
