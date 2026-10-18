import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData,useNavigation } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { Button,Callout } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { downloadBlob,safeFilename } from '@/utils/download'
import type { StoryCreateRequest } from '@/shared'
import { NovelCreateDialog } from './NovelCreateDialog'
import type { PendingNovelCreation } from '../persistence/creationJournal'

export function NovelPendingCreations({onResolved,beforeOpen}:{onResolved?:()=>void;beforeOpen?:()=>Promise<boolean>}){
    const {novelCreations,createStory}=useData(),{setPage}=useNavigation(),{t}=useTranslation()
    const [pending,setPending]=useState<string|null>(null),[failure,setFailure]=useState<{scope:string;message:string}|null>(null)
    const mounted=useRef(true),flight=useRef<{scope:string;id:number}|null>(null),sequence=useRef(0),live=useRef(novelCreations?.sessionKey)
    useLayoutEffect(()=>{live.current=novelCreations?.sessionKey},[novelCreations?.sessionKey])
    const busy=pending!==null&&pending===novelCreations?.sessionKey
    const error=failure?.scope===novelCreations?.sessionKey?failure?.message:null
    const [reviewing,setReviewing]=useState<{record:PendingNovelCreation;session:string}|null>(null)
    const [discarding,setDiscarding]=useState<{record:PendingNovelCreation;session:string}|null>(null)
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const text=(key:string)=>t('novelEditor.creationRecovery.'+key)
    async function act(record:PendingNovelCreation,open=false){
        if(!novelCreations||(flight.current&&flight.current.scope===novelCreations.sessionKey))return
        const scope=novelCreations.sessionKey,id=++sequence.current
        const current=()=>mounted.current&&live.current===scope
        flight.current={scope,id};setPending(scope);setFailure(null)
        try{
            if(open){
                if(beforeOpen&&!await beforeOpen()||!current())return
                await novelCreations.open(record)
                if(current())setPage('story')
            }else {
                const confirmed=await novelCreations.retry(record)
                if(!current())return
                if(confirmed)onResolved?.()
                else if(record.write.rejected)setReviewing({record,session:novelCreations.sessionKey})
            }
        }catch(error){if(current())setFailure({scope,message:error instanceof ApiError&&error.code==='WORKSPACE_ARCHIVED'?'archived':'failed'})}
        finally{if(flight.current?.id===id){flight.current=null;if(current())setPending(null)}}
    }
    if(!novelCreations?.items.length)return null
    const retained=reviewing?.session===novelCreations.sessionKey?novelCreations.items.find((item)=>item.write.rejected&&item.write.write.requestId===reviewing.record.write.write.requestId):undefined
    const draft=retained?{...retained.write.write}:undefined
    if(draft){delete (draft as Partial<typeof draft>).requestId;delete draft.expectedSourceVersion}
    return <><Callout tone="warning" role="status">
        <p>{text(novelCreations.items.every((item)=>item.write.rejected)?'draftHelp':'help')}</p>
        <ul className="mt-3 space-y-3">{novelCreations.items.map((record)=><li key={record.write.write.requestId} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{record.write.write.title} · {text(record.write.rejected?'draftRetained':record.write.ack?'ready':'pending')}</span>
            <Button variant="secondary" size="sm" disabled={busy||novelCreations.busy(record)} onClick={()=>void act(record,Boolean(record.write.ack))}>{text(record.write.rejected?'reviewDraft':record.write.ack?'open':'recover')}</Button>
            {record.write.rejected&&<>
                <Button variant="secondary" size="sm" onClick={()=>downloadBlob(new Blob([JSON.stringify(record.write.write,null,2)],{type:'application/json'}),safeFilename(record.write.write.title,'novel')+'-creation-draft.json')}>{text('downloadDraft')}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={()=>setDiscarding({record,session:novelCreations.sessionKey})}>{text('discardDraft')}</Button>
            </>}
            {record.write.ack&&<Button variant="ghost" size="sm" disabled={busy} onClick={()=>novelCreations.dismiss(record)}>{text('dismiss')}</Button>}
            {record.storageFailed&&<p className="w-full">{text('storageFailed')}</p>}
        </li>)}</ul>
        {error&&<p role="alert" className="mt-3">{text(error)}</p>}
    </Callout>
        {retained&&draft&&<NovelCreateDialog open initialRequest={draft as StoryCreateRequest} creating={busy} blocked={novelCreations.items.some((item)=>!item.write.ack&&!item.write.rejected)} onClose={()=>setReviewing(null)}
            onCreate={async(request)=>{
                const scope=novelCreations.sessionKey
                if(beforeOpen&&!await beforeOpen())throw new Error('Save the current manuscript before creating a novel')
                if(!mounted.current||live.current!==scope)throw new ApiError(409,'Creation scope changed',{code:'STORY_SCOPE_CHANGED'})
                await createStory(request,{replaceRejectedRequestId:retained.write.write.requestId})
                if(mounted.current&&live.current===scope){setReviewing(null);onResolved?.();setPage('story')}
            }}/>}
        <ConfirmDialog visible={Boolean(discarding&&discarding.session===novelCreations.sessionKey)} title={text('discardTitle')} message={text('discardHelp')} confirmLabel={text('discardDraft')} variant="danger"
            onCancel={()=>setDiscarding(null)} onConfirm={()=>{if(discarding?.session===novelCreations.sessionKey)novelCreations.dismiss(discarding.record);setDiscarding(null)}}/>
    </>
}
