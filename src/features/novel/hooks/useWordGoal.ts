/** Word goals are independently revised server metadata, with exact request recovery. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryChapterWrite, StoryUnitMetadata } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { adoptNovelMutation, isNovelRequestId, isNovelRevision, isRecord, novelMutationKey, readNovelMutation, retireNovelMutation, type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { makeRequestId } from '@/utils/uuid'
import type { StoryWorkspace } from './useStoryWorkspace'

const MAX_WORD_GOAL=2_147_483_647
function normalizeGoal(value:unknown):number|null {
    if(typeof value!=='number'||!Number.isFinite(value))return null
    const rounded=Math.round(value)
    return rounded>0&&rounded<=MAX_WORD_GOAL?rounded:null
}
type GoalWrite=StoryChapterWrite&{wordGoal:number|null}
function accepts(value:unknown):value is GoalWrite {
    return isRecord(value)&&Object.keys(value).length===3&&isNovelRequestId(value.requestId)&&isNovelRevision(value.expectedMetadataRevision)
        &&(value.wordGoal===null||typeof value.wordGoal==='number'&&Number.isInteger(value.wordGoal)&&normalizeGoal(value.wordGoal)===value.wordGoal)
}
export interface WordGoalApi {
    goal:number|null
    setGoal:(goal:number|null)=>Promise<boolean>
    pending:GoalWrite|null
    retry:()=>Promise<boolean>
    storageFailed:boolean
}
export function useWordGoal(storyId:string|null,unit:StoryUnitMetadata|null,
    workspace:Pick<StoryWorkspace,'isCurrent'>&{workspaceId?:string|null},kind:'chapter'|'scene'='scene'):WordGoalApi {
    const {updateStoryChapter,updateStoryScene,refreshStory}=useData()
    const {isAuthenticated,openLoginModal,userHash}=useAuth()
    const workspaceReadOnly=useWorkspaceReadOnly(workspace.workspaceId)
    const readOnly=workspaceReadOnly||Boolean(unit?.inheritance?.readOnly)
    const key=novelMutationKey('goal',{userHash,workspaceId:workspace.workspaceId,storyId},kind+':'+unit?.id)
    const identity=key??JSON.stringify([storyId,kind,unit?.id])
    const [ack,setAck]=useState({identity,goal:normalizeGoal(unit?.wordGoal)})
    const [recovery,setRecovery]=useState(()=>({identity,record:readNovelMutation(key,accepts)}))
    const [storage,setStorage]=useState<{identity:string;failed:boolean}>({identity,failed:false})
    const pending=recovery.identity===identity?recovery.record:null
    const target=useRef({identity,key,storyId,unit,workspace,readOnly,workspaceReadOnly,isAuthenticated,pending})
    useLayoutEffect(()=>{target.current={identity,key,storyId,unit,workspace,readOnly,workspaceReadOnly,isAuthenticated,pending}})
    const busy=useRef(false)
    const mounted=useRef(true)
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    useEffect(()=>{
        // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribe to the selected unit's acknowledged server goal
        setAck({identity,goal:normalizeGoal(unit?.wordGoal)})
    },[identity,unit?.wordGoal])
    useEffect(()=>{
        // eslint-disable-next-line react-hooks/set-state-in-effect -- explicitly offer the selected unit's scoped request after navigation
        setRecovery({identity,record:readNovelMutation(key,accepts)})
    },[identity,key])
    useEffect(()=>{
        if(!storyId)return
        try{
            const prefix=`magic_worlds:novel:wordGoal:${storyId}:`
            for(const candidate of Object.keys(localStorage))if(candidate.startsWith(prefix))localStorage.removeItem(candidate)
        }catch{/* Obsolete per-story goals are never uploaded. */}
    },[storyId])
    const perform=useCallback(async(next:number|null,retry=false)=>{
        const current=target.current
        if(!current.storyId||!current.unit||current.workspaceReadOnly||current.readOnly&&!current.pending||!current.workspace.isCurrent()||busy.current)return false
        if(!current.isAuthenticated){openLoginModal();return false}
        const normalized=normalizeGoal(next)
        if(next!==null&&normalized===null)return false
        if(current.pending&&!retry&&current.pending.write.wordGoal!==normalized)return false
        const record:NovelJournalRecord<GoalWrite>=current.pending??{schema:1,write:{wordGoal:normalized,expectedMetadataRevision:current.unit.metadataRevision,requestId:makeRequestId('novel-goal')}}
        const isCurrent=()=>mounted.current&&target.current.identity===current.identity&&current.workspace.isCurrent()
        busy.current=true
        const stored=adoptNovelMutation(current.key,record)
        target.current.pending=record
        setRecovery({identity:current.identity,record})
        setStorage({identity:current.identity,failed:Boolean(current.key)&&!stored})
        try{
            const updated=await(kind==='chapter'?updateStoryChapter:updateStoryScene)(current.storyId,current.unit.id,record.write)
            retireNovelMutation(record,current.key)
            if(isCurrent()){
                target.current.pending=null
                setRecovery({identity:current.identity,record:null})
                setAck({identity:current.identity,goal:normalizeGoal(updated.wordGoal)})
                setStorage({identity:current.identity,failed:false})
            }
            return true
        }catch(error){
            if(error instanceof ApiError&&error.status>=400&&error.status<500&&![408,429].includes(error.status)){
                retireNovelMutation(record,current.key)
                if(isCurrent()){target.current.pending=null;setRecovery({identity:current.identity,record:null})}
                if(error.status===409)try{await refreshStory(current.storyId)}catch{/* A conflict leaves the account goal unchanged. */}
            }
            return false
        }finally{busy.current=false}
    },[kind,openLoginModal,updateStoryChapter,updateStoryScene,refreshStory])
    const retry=()=>target.current.pending?perform(target.current.pending.write.wordGoal,true):Promise.resolve(false)
    return {goal:ack.identity===identity?ack.goal:normalizeGoal(unit?.wordGoal),setGoal:perform,pending:pending?.write??null,retry,storageFailed:storage.identity===identity&&storage.failed}
}
