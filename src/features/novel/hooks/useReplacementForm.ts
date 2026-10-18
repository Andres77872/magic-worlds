import { useLayoutEffect,useRef,useState } from 'react'
import { adoptNovelMutation,novelMutationKey,readNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { emptyReplacementForm,isReplacementForm,type ReplacementForm } from '../persistence/replacementForm'

export function useReplacementForm(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined;storyId:string|null},ownerKey:string|null){
    const key=novelMutationKey('manuscript-search-form',scope,'form')
    type State={key:string|null;ownerKey:string|null;form:ReplacementForm;recovery:NovelJournalRecord<ReplacementForm>|null;storageFailed:boolean}
    const initial=():State=>({key,ownerKey,form:{...emptyReplacementForm},recovery:readNovelMutation(key,isReplacementForm),storageFailed:false})
    const [state,setState]=useState<State>(initial)
    let active=state
    if(state.key!==key||state.ownerKey!==ownerKey){active=initial();setState(active)}
    const live=useRef(active)
    useLayoutEffect(()=>{live.current=active},[active])
    const current=()=>live.current.ownerKey===ownerKey&&live.current.key===key
    return {form:active.form,recovery:active.recovery,storageFailed:active.storageFailed,
        update:(patch:Partial<ReplacementForm>)=>{
            if(!current())return
            const form={...live.current.form,...patch}
            if(!isReplacementForm(form))return
            const next={...live.current,form,storageFailed:!writeNovelMutation(key,form)}
            live.current=next;setState(next)
        },
        resume:()=>{
            if(!current()||!live.current.recovery)return
            const record=live.current.recovery,next={key,ownerKey,form:{...record.write},recovery:null,storageFailed:!adoptNovelMutation(key,record)}
            live.current=next;setState(next)
        }}
}
