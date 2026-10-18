import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel, storyScene, storyChapter } from '@/test/fixtures/story'
import { novelMutationKey, writeNovelMutation } from '@/shared/novelMutationJournal'
import { metadataPatch, metadataSeed, rebaseMetadata } from '../persistence/metadataJournal'

const mocks=vi.hoisted(()=>({update:vi.fn(),refresh:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'details-author'}),useData:()=>({updateStory:mocks.update,updateStoryPart:mocks.update,updateStoryChapter:mocks.update,updateStoryScene:mocks.update,refreshStory:mocks.refresh})}))
import { useMetadataDraft } from './useMetadataDraft'

const scene=storyScene({id:'scene-one',chapterId:'chapter-one',revision:4,metadataRevision:2,details:{notes:'Original note',tense:'Past'}})
const story=novel({organization:{workspace_id:'work-one'},chapters:[storyChapter({id:'chapter-one',scenes:[scene]})]})
const options={story,unit:scene,kind:'scene' as const,readOnly:false,beforeWrite:async()=>true}
const key=novelMutationKey('details',{userHash:'details-author',workspaceId:'work-one',storyId:story.id},'scene:'+scene.id)!
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();mocks.update.mockResolvedValue({...scene,metadataRevision:3});mocks.refresh.mockResolvedValue(story)})

describe('scoped writing details recovery',()=>{
    it('retains final keystrokes when the inspector closes and requires a recovery choice on reopen',()=>{
        const first=renderHook(()=>useMetadataDraft(options))
        act(()=>{first.result.current.setDetail('notes','Unsent writing notes')})
        first.unmount()
        const reopened=renderHook(()=>useMetadataDraft(options))
        expect(reopened.result.current.form.details.notes).toBe('Original note')
        expect(reopened.result.current.recovery?.write.form.details.notes).toBe('Unsent writing notes')
        expect(mocks.update).not.toHaveBeenCalled()
        act(()=>{reopened.result.current.resume()})
        expect(reopened.result.current.form.details.notes).toBe('Unsent writing notes')
    })

    it('keeps an uncertain request immutable across reload and retires it only after acknowledgement',async()=>{
        mocks.update.mockRejectedValueOnce(new Error('Response lost'))
        const first=renderHook(()=>useMetadataDraft(options))
        act(()=>{first.result.current.edit('goal','800')})
        await act(async()=>{await first.result.current.save()})
        const original=mocks.update.mock.calls[0][2]
        expect(original).toMatchObject({wordGoal:800,expectedMetadataRevision:2,requestId:expect.any(String)})
        expect(original).not.toHaveProperty('document')
        act(()=>{first.result.current.edit('goal','900')})
        expect(first.result.current.form.goal).toBe('800')
        first.unmount()
        const reopened=renderHook(()=>useMetadataDraft(options))
        act(()=>{reopened.result.current.resume()})
        await act(async()=>{await reopened.result.current.save()})
        expect(mocks.update.mock.calls[1][2]).toEqual(original)
        expect(reopened.result.current.pending).toBe(false)
        reopened.unmount()
        expect(localStorage.getItem(key)).toBeNull()
    })

    it('rebases only changed fields after an explicit conflict comparison and does not save automatically',async()=>{
        const account={...scene,title:'Title changed elsewhere',metadataRevision:3,details:{notes:'Remote note',tense:'Present',synopsis:'Remote synopsis'}}
        mocks.update.mockRejectedValueOnce(new ApiError(409,'Stale metadata'))
        mocks.refresh.mockResolvedValue(novel({...story,chapters:[storyChapter({id:'chapter-one',scenes:[account]})]}))
        const {result}=renderHook(()=>useMetadataDraft(options))
        act(()=>{result.current.setDetail('notes','My revised note')})
        await act(async()=>{await result.current.save()})
        expect(result.current.conflict?.form.title).toBe(account.title)
        expect(result.current.pending).toBe(false)
        await act(async()=>{await result.current.accountVersion(true)})
        expect(result.current.form).toMatchObject({title:account.title,details:{notes:'My revised note',tense:'Present',synopsis:'Remote synopsis'}})
        expect(mocks.update).toHaveBeenCalledTimes(1)
        await act(async()=>{await result.current.save()})
        expect(mocks.update.mock.calls[1][2]).toMatchObject({expectedMetadataRevision:3,details:{notes:'My revised note',tense:'Present',synopsis:'Remote synopsis'}})
        expect(mocks.update.mock.calls[1][2]).not.toHaveProperty('title')
    })

    it('does not resurrect a recovered writer after adopting its draft and reloading again',async()=>{
        const other=novelMutationKey('details',{userHash:'details-author',workspaceId:'work-one',storyId:story.id},'scene:'+scene.id,'old-tab')!
        const checkpoint=metadataSeed(scene,'scene')
        checkpoint.form.goal='600'
        writeNovelMutation(other,checkpoint)
        const first=renderHook(()=>useMetadataDraft(options))
        act(()=>{first.result.current.resume()})
        expect(localStorage.getItem(other)).toBeNull()
        first.unmount()
        const second=renderHook(()=>useMetadataDraft(options))
        act(()=>{second.result.current.resume()})
        await act(async()=>{await second.result.current.save()})
        second.unmount()
        const third=renderHook(()=>useMetadataDraft(options))
        expect(third.result.current.recovery).toBeNull()
    })

    it('starts no write after a save barrier finishes in a closed inspector',async()=>{
        let release!:(value:boolean)=>void
        const first=renderHook(()=>useMetadataDraft({...options,beforeWrite:()=>new Promise((resolve)=>{release=resolve})}))
        act(()=>{first.result.current.edit('title','Local title')})
        let saving!:Promise<boolean>
        act(()=>{saving=first.result.current.save()})
        first.unmount()
        await act(async()=>{release(true);await saving})
        expect(mocks.update).not.toHaveBeenCalled()
        expect(localStorage.getItem(key)).not.toBeNull()
    })

    it('keeps invalid input recoverable and refuses writes while read-only',async()=>{
        const {result,unmount}=renderHook(()=>useMetadataDraft(options))
        act(()=>{result.current.edit('goal','0')})
        await act(async()=>{await result.current.save()})
        expect(result.current.failure).toBe('failed')
        expect(mocks.update).not.toHaveBeenCalled()
        unmount()
        const reader=renderHook(()=>useMetadataDraft({...options,readOnly:true}))
        act(()=>{reader.result.current.resume()})
        await act(async()=>{await reader.result.current.save()})
        expect(reader.result.current.form.goal).toBe('0')
        expect(mocks.update).not.toHaveBeenCalled()
    })
})

it('pins a manually changed summary to the source scene revision and preserves independent goals',()=>{
    const checkpoint=metadataSeed(scene,'scene')
    checkpoint.form.details.summary='A summary of revision four'
    expect(metadataPatch(checkpoint,'summary-1')).toEqual({requestId:'summary-1',expectedMetadataRevision:2,details:{...scene.details,summary:checkpoint.form.details.summary,summaryRevision:4}})
    const remote=metadataSeed({...scene,metadataRevision:3,wordGoal:1200,details:{notes:'Updated note',tense:'Present'}},'scene')
    const rebased=rebaseMetadata(checkpoint,remote)
    expect(rebased.form.goal).toBe('1200')
    expect(rebased.form.details).toMatchObject({notes:'Updated note',tense:'Present',summary:checkpoint.form.details.summary})
})
