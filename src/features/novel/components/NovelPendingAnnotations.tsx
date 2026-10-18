import { useTranslation } from 'react-i18next'
import { Button,Callout } from '@/ui/primitives'
import type { PersonalAnnotations } from '../hooks/usePersonalAnnotations'
import { annotationIntentKind } from '../persistence/annotationJournal'

/** Kept outside the drawer so closing a review never hides uncertain requests. */
export function NovelPendingAnnotations({annotations,onOpen}:{annotations:PersonalAnnotations;onOpen:(kind?:'note'|'bookmark')=>void}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.annotations.'+key,values)
    const {mutations,drafts}=annotations
    if(!mutations.items.length&&!drafts.items.length&&!mutations.error)return null
    const bookmarks=mutations.items.some((record)=>annotationIntentKind(record.write)==='bookmark')||drafts.items.some((record)=>record.write.kind==='bookmark')
    return <section className="space-y-3" aria-label={bookmarks?t('novelEditor.bookmarks.pendingGroupTitle'):copy('pendingTitle')}>
        {mutations.error&&<Callout tone="warning" role="alert">{t('novelEditor.'+(mutations.errorKind==='bookmark'?'bookmarks':'annotations')+'.'+mutations.error)}</Callout>}
        {mutations.items.map((record)=>{const local=(key:string)=>t('novelEditor.'+(annotationIntentKind(record.write)==='bookmark'?'bookmarks':'annotations')+'.'+key);return <Callout key={record.write.write.requestId} tone="warning" role="status">
            <p>{local(record.write.ack?'pendingConfirmed':'pending')}</p>
            {record.storageFailed&&<p className="mt-2 text-caption">{copy('storageFailed')}</p>}
            <Button size="sm" variant="secondary" className="mt-3" disabled={mutations.busy(record)} onClick={()=>void mutations.recover(record).catch(()=>{})}>{local(record.write.ack?'loadConfirmed':'recover')}</Button>
        </Callout>})}
        {(['note','bookmark'] as const).map((kind)=>{const count=drafts.items.filter((record)=>(record.write.kind??'note')===kind).length,local=(key:string)=>t('novelEditor.'+(kind==='bookmark'?'bookmarks':'annotations')+'.'+key,{count});return count>0&&<Callout key={kind} role="status">
            <p>{local('unsentCount')}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={()=>onOpen(kind)}>{local('openNotes')}</Button>
        </Callout>})}
    </section>
}
