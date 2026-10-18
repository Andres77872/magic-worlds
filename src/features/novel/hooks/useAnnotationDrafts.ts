import { useCallback,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks'
import { novelMutationKey,writeNovelMutation,retireNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { isAnnotationDraft,listAnnotationDrafts,type AnnotationDraft,type AnnotationIntent } from '../persistence/annotationJournal'
import type { StoryWorkspace } from './useStoryWorkspace'

const EVENT='novel-annotation-draft:changed',signal=()=>window.dispatchEvent(new Event(EVENT))
export type PersonalNoteDraft=NovelJournalRecord<AnnotationDraft>&{storageFailed?:boolean}
export function useAnnotationDrafts(storyId:string|null,workspace:StoryWorkspace){
    const {userHash}=useAuth(),scope=JSON.stringify([userHash,workspace.workspaceId,storyId])
    const memory=useRef(new Map<string,Map<string,PersonalNoteDraft>>()),live=useRef({scope,storyId,workspace,userHash})
    const [state,setState]=useState<{scope:string;items:PersonalNoteDraft[]}>({scope,items:[]})
    useLayoutEffect(()=>{live.current={scope,storyId,workspace,userHash}})
    const gather=useCallback(()=>{
        const rows=new Map<string,PersonalNoteDraft>()
        for(const row of listAnnotationDrafts({userHash,workspaceId:workspace.workspaceId}))if(row.write.storyId===storyId&&!rows.has(row.write.annotationId))rows.set(row.write.annotationId,row)
        for(const [id,row] of memory.current.get(scope)??[])rows.set(id,row)
        return [...rows.values()]
    },[scope,storyId,userHash,workspace.workspaceId])
    useLayoutEffect(()=>{
        const refresh=()=>setState({scope,items:gather()})
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[scope,gather])
    const keyFor=(draft:AnnotationDraft)=>novelMutationKey('annotation-draft',{userHash,workspaceId:workspace.workspaceId,storyId:draft.storyId},draft.annotationId)
    const remove=(record:PersonalNoteDraft)=>{
        if(live.current.scope!==scope||record.write.storyId!==storyId||!workspace.isCurrent())return
        const key=keyFor(record.write)
        if(record.storageKey?.split('::writer:')[0]!==key?.split('::writer:')[0])return
        retireNovelMutation(record,key)
        const rows=memory.current.get(scope),current=rows?.get(record.write.annotationId)
        if(current&&canonicalJson(current.write)===canonicalJson(record.write))rows?.delete(record.write.annotationId)
        signal()
    }
    return {items:state.scope===scope?state.items:[],
        save:(draft:AnnotationDraft,previous?:PersonalNoteDraft):PersonalNoteDraft|null=>{
            if(live.current.scope!==scope||draft.storyId!==storyId||!workspace.isCurrent()||!isAnnotationDraft(draft))return null
            const write=JSON.parse(JSON.stringify(draft)) as AnnotationDraft,key=keyFor(write),saved=writeNovelMutation(key,write)
            if(saved&&previous?.storageKey&&previous.storageKey!==key&&previous.storageKey.split('::writer:')[0]===key?.split('::writer:')[0])retireNovelMutation(previous,null)
            const record:PersonalNoteDraft={schema:1,write,storageKey:key??undefined,writtenAt:Date.now(),storageFailed:!saved}
            let rows=memory.current.get(scope);if(!rows){rows=new Map();memory.current.set(scope,rows)}
            rows.set(write.annotationId,record);signal();return record
        },remove,
        confirm:(intent:AnnotationIntent)=>{if(intent.storyId===storyId&&intent.draft)remove(intent.draft)},
    }
}
export type AnnotationDrafts=ReturnType<typeof useAnnotationDrafts>
