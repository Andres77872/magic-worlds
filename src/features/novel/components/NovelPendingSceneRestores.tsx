import { useTranslation } from 'react-i18next'
import { Button,Callout } from '@/ui/primitives'
import type { SceneRestores } from '../hooks/useSceneRestores'

export function NovelPendingSceneRestores({restores}:{restores:SceneRestores}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.revisions.'+key,values)
    if(!restores.items.length&&!restores.error)return null
    return <section className="space-y-3" aria-label={copy('pendingTitle')}>
        {restores.error&&<Callout tone="warning" role="alert">{copy(restores.error)}</Callout>}
        {restores.items.map((record)=><Callout key={record.write.sceneId+':'+record.write.write.requestId} tone="warning" role="status">
            <p>{copy(record.write.ack?'pendingConfirmed':'pending',{title:record.write.sceneTitle,source:record.write.revision,revision:record.write.ack?.revision})}</p>
            {record.storageFailed&&<p className="mt-2 text-caption">{copy('storageFailed')}</p>}
            <Button size="sm" variant="secondary" disabled={restores.busy(record)} className="mt-3" onClick={()=>void restores.recover(record).catch(()=>{})}>{copy(record.write.ack?'loadConfirmed':'recover')}</Button>
        </Callout>)}
    </section>
}
