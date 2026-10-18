import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button,Callout,Field,Textarea } from '@/ui/primitives'
import type { NovelErases,PendingNovelErase } from '../hooks/useNovelErases'

export function NovelPendingErases({erases,onResolved}:{erases:NovelErases;onResolved?:()=>void}){
    const {t}=useTranslation(),live=useRef(erases.scopeKey),mounted=useRef(true)
    useLayoutEffect(()=>{live.current=erases.scopeKey})
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const [job,setJob]=useState<{scope:string;id:string}|null>(null),[detail,setDetail]=useState<{scope:string;id:string}|null>(null)
    const busy=job?.scope===erases.scopeKey?job.id:null,details=detail?.scope===erases.scopeKey?detail.id:null
    const text=(key:string)=>t('novelEditor.erasure.'+key)
    async function run(record:PendingNovelErase,retry=false){
        if(busy||!mounted.current)return
        const scope=erases.scopeKey,id=JSON.stringify([record.write.storyId,record.write.write.requestId])
        setJob({scope,id})
        try{if(await (retry?erases.retry(record):erases.check(record))&&live.current===scope&&mounted.current)onResolved?.()}
        catch{/* The scoped controller keeps the immutable request and useful error. */}
        finally{if(live.current===scope&&mounted.current)setJob(null)}
    }
    if(!erases.items.length&&!erases.error)return null
    return <Callout tone="warning" role="status">
        <div className="space-y-3">
            {erases.items.length>0&&<><strong>{text('pendingTitle')}</strong><p>{text('pendingHelp')}</p></>}
            {erases.items.map((record)=>{
                const id=JSON.stringify([record.write.storyId,record.write.write.requestId]),waiting=Boolean(busy)||erases.busy(record)
                return <div key={id} className="space-y-2">
                    <p className="break-words">{record.write.write.confirmedTitle} · {text(record.write.ack?'confirmed':'pending')}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" disabled={waiting} onClick={()=>void run(record)}>{text('check')}</Button>
                        {!record.write.ack&&record.checkedMissing&&<Button variant="danger" size="sm" disabled={waiting||erases.readOnly} onClick={()=>void run(record,true)}>{text('retry')}</Button>}
                        <Button variant="ghost" size="sm" onClick={()=>setDetail((old)=>old?.scope===erases.scopeKey&&old.id===id?null:{scope:erases.scopeKey,id})}>{text('details')}</Button>
                    </div>
                    {record.storageFailed&&<p>{text('storageFailed')}</p>}
                    {details===id&&<Field label={text('detailsLabel')}><Textarea readOnly rows={5} value={JSON.stringify(record.write,null,2)}/></Field>}
                </div>
            })}
            {erases.readOnly&&erases.items.length>0&&<p>{text('readonly')}</p>}
            {erases.error&&<p role="alert">{text(erases.error==='pending'?'pendingOperation':erases.error)}</p>}
        </div>
    </Callout>
}
