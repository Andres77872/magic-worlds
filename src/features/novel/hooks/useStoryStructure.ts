import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryOutline, StoryStructureOperation } from '@/shared'
import { makeRequestId } from '@/utils/uuid'
import { readStructureJournal, retireStructureJournal, structureJournalKey, type PendingStructure } from '../persistence/structureJournal'
import { adoptNovelMutation } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import type { StoryWorkspace } from './useStoryWorkspace'

export function useStoryStructure(story:StoryOutline|null,workspace:StoryWorkspace,readOnly:boolean,onSelect:(id:string,source?:StoryOutline)=>void) {
    const {changeStoryStructure,recoverStoryStructure,refreshStory}=useData()
    const {userHash,isAuthenticated,openLoginModal}=useAuth()
    const key=structureJournalKey(userHash,workspace.workspaceId,story?.id??null)
    const [pending,setPending]=useState<PendingStructure|null>(null)
    const [busy,setBusy]=useState(false)
    const [error,setError]=useState<string|null>(null)
    const [storageFailed,setStorageFailed]=useState(false)
    const attempt=useRef<PendingStructure|null>(null)
    const running=useRef(new Set<string|null>())
    const live=useRef({story,workspace,readOnly,key,userHash,onSelect})
    useLayoutEffect(()=>{live.current={story,workspace,readOnly,key,userHash,onSelect}})
    useEffect(()=>{
        const record=readStructureJournal(key)
        attempt.current=record
        // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribe to the newly opened, scoped recovery record
        setPending(record);setError(null);setStorageFailed(false);setBusy(running.current.has(key))
    },[key])
    const perform=useCallback(async(operation?:StoryStructureOperation):Promise<StoryOutline|null>=>{
        const current=live.current
        if (!current.story||!current.workspace.isCurrent()||running.current.has(current.key)) return null
        if (!isAuthenticated) {openLoginModal();return null}
        if (!attempt.current) attempt.current=readStructureJournal(current.key)
        if(current.readOnly&&!attempt.current)return null
        const recovering=Boolean(attempt.current)
        if (attempt.current&&operation&&canonicalJson(attempt.current.write.operation)!==canonicalJson(operation)) {
            setError('pending');return null
        }
        const record=attempt.current??(operation ? {schema:1 as const,write:{requestId:makeRequestId('novel-structure'),expectedStructureRevision:current.story.structureRevision,operation:JSON.parse(JSON.stringify(operation)) as StoryStructureOperation}} : null)
        if (!record) return null
        attempt.current=record;setPending(record);setError(null);running.current.add(current.key);setBusy(true)
        setStorageFailed(!adoptNovelMutation(current.key,record))
        try {
            let result=recovering?await recoverStoryStructure(current.story.id,record.write):null
            if(!result){
                if(current.readOnly)throw new ApiError(409,'Restore the workspace before retrying uncommitted work.',{code:'WORKSPACE_ARCHIVED'})
                if(!current.workspace.isCurrent())return null
                result=await changeStoryStructure(current.story.id,record.write)
            }
            retireStructureJournal(record,current.key)
            if (live.current.key===current.key&&current.workspace.isCurrent()) {
                attempt.current=null;setPending(null)
                if (result.selectedId) live.current.onSelect(result.selectedId,result.story)
            }
            return result.story
        } catch (failure) {
            if (live.current.key!==current.key) return null
            const code=failure instanceof ApiError ? failure.code : null
            setError(failure instanceof ApiError&&failure.status===409 ? code??'conflict' : 'failed')
            if (failure instanceof ApiError&&failure.status>=400&&failure.status<500&&![401,403,408,429].includes(failure.status)&&code!=='WORKSPACE_ARCHIVED') {
                retireStructureJournal(record,current.key);attempt.current=null;setPending(null)
                if (failure.status===409) await refreshStory(current.story.id).catch(()=>{})
            }
            return null
        } finally {running.current.delete(current.key);if (live.current.key===current.key) setBusy(false)}
    },[changeStoryStructure,recoverStoryStructure,isAuthenticated,openLoginModal,refreshStory])
    return {perform,retry:()=>perform(),pending,busy,error,storageFailed,clearError:()=>setError(null)}
}
