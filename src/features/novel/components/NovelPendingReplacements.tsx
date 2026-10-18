import { useTranslation } from 'react-i18next'
import { Button,Callout } from '@/ui/primitives'
import type { ManuscriptReplacements } from '../hooks/useManuscriptReplacements'

export function NovelPendingReplacements({replacements}:{replacements:ManuscriptReplacements}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.replacements.'+key,values)
    if(!replacements.items.length&&!replacements.error&&!replacements.historyStorageFailed)return null
    return <section className="space-y-3" aria-label={copy('pendingTitle')}>
        {replacements.error&&<Callout tone="warning" role="alert">{copy(replacements.error)}</Callout>}
        {replacements.historyStorageFailed&&<Callout tone="warning" role="status">{copy('historyStorageFailed')}</Callout>}
        {replacements.items.map((record)=><Callout key={record.write.write.requestId} tone="warning" role="status">
            <p>{copy(record.write.ack?'confirmedPending':'pending',{count:record.write.heads.length})}</p>
            {record.storageFailed&&<p className="mt-2 text-caption">{copy('storageFailed')}</p>}
            <Button size="sm" variant="secondary" className="mt-3" disabled={replacements.busy(record)} onClick={()=>void replacements.recover(record).catch(()=>{})}>{copy(record.write.ack?'loadConfirmed':'recover')}</Button>
        </Callout>)}
    </section>
}
