import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button,Callout } from '@/ui/primitives'
import type { NovelCopies,PendingNovelCopy } from '../hooks/useNovelCopies'

export function NovelPendingCopies({copies,onResolved}:{copies:NovelCopies;onResolved?:()=>void}){
    const {t}=useTranslation()
    const [busy,setBusy]=useState(false)
    const [failed,setFailed]=useState(false)
    const text=(key:string)=>t('novelEditor.copyNovel.'+key)
    async function act(record:PendingNovelCopy,open=false){
        if(busy)return
        setBusy(true);setFailed(false)
        try{if(open)await copies.open(record);else if(await copies.retry(record))onResolved?.()}
        catch{setFailed(true)}finally{setBusy(false)}
    }
    if(!copies.items.length&&!copies.error)return null
    return <Callout tone="warning" role="status">
        <ul className="space-y-3">{copies.items.map((record)=><li key={record.write.sourceId+record.write.write.requestId} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{record.write.write.title} · {text(record.write.ack?'ready':'pending')}</span>
            <Button variant="secondary" size="sm" disabled={busy||copies.busy(record)} onClick={()=>void act(record,Boolean(record.write.ack))}>{text(record.write.ack?'open':'recover')}</Button>
            {record.write.ack&&<Button variant="ghost" size="sm" disabled={busy} onClick={()=>copies.dismiss(record)}>{text('dismiss')}</Button>}
            {record.storageFailed&&<p className="w-full">{text('storageFailed')}</p>}
        </li>)}</ul>
        {(failed||copies.error)&&<p role="alert" className="mt-3">{text(copies.error??'failed')}</p>}
    </Callout>
}
