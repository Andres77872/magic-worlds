import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '@/app/hooks'
import { Button, Callout } from '@/ui/primitives'

/** Workspace-wide recovery remains reachable after an interrupted Trash or archive. */
export function NovelPendingLifecycle({readOnly=false,onResolved,beforeWrite}:{readOnly?:boolean;onResolved?:()=>void;beforeWrite?:(storyId:string)=>Promise<boolean>}) {
    const {t}=useTranslation()
    const {pendingStoryLifecycle,retryStoryLifecycle}=useData()
    const [busy,setBusy]=useState<string|null>(null)
    const [failureId,setFailureId]=useState<string|null>(null)
    const flight=useRef(false)
    const mounted=useRef(true)
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const items=Array.isArray(pendingStoryLifecycle)?pendingStoryLifecycle:[]
    async function retry(storyId:string,requestId:string){
        if(readOnly||flight.current)return
        flight.current=true;setBusy(requestId);setFailureId(null)
        try{if(beforeWrite&&!await beforeWrite(storyId)||!mounted.current)return;await retryStoryLifecycle(storyId,requestId);if(mounted.current)onResolved?.()}
        catch{if(mounted.current)setFailureId(requestId)}
        finally{flight.current=false;if(mounted.current)setBusy(null)}
    }
    if(!items.length)return null
    return <Callout tone="warning" role="status">
        <p>{t('novelEditor.structure.lifecyclePending')}</p>
        <ul className="mt-3 space-y-3">{items.map((item)=><li key={item.storyId+':'+item.write.requestId} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{item.title} · {t('novelEditor.structure.'+item.write.action)}</span>
            <Button variant="secondary" size="sm" disabled={readOnly||busy!==null} aria-busy={busy===item.write.requestId} onClick={()=>void retry(item.storyId,item.write.requestId)}>{t('novelEditor.save.retry')}</Button>
            {item.storageFailed&&<p className="w-full">{t('novelEditor.recovery.storageFailed')}</p>}
        </li>)}</ul>
        {items.some((item)=>item.write.requestId===failureId)&&<p role="alert" className="mt-3">{t('novelEditor.structure.failed')}</p>}
    </Callout>
}
