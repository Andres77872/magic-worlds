import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import type { StoryDocumentRevision,StoryDocumentRevisionSummary,StorySceneDocument,StorySceneRevisionPage,StorySceneRevisionQuery,StorySceneRestoreAcknowledgement } from '@/shared'
import { Badge,Button,Callout,Drawer,Field,Icon,Input,Modal,Select,Textarea } from '@/ui/primitives'
import { Markdown } from '@/ui/components/Markdown'
import { ApiError } from '@/infrastructure/api'
import { STORY_REVISION_SOURCES } from '@/infrastructure/api/storyRevisionContract'
import type { SceneRevisionSource } from '../hooks/useSceneRevisionSource'
import type { SceneRestores } from '../hooks/useSceneRestores'
import type { SceneRestoreIntent } from '../persistence/sceneRestoreJournal'
import { downloadBlob,safeFilename } from '@/utils/download'
import { makeRequestId } from '@/utils/uuid'

interface Props {open:boolean;onClose:()=>void;source:SceneRevisionSource|null;readOnly:boolean;beforeWrite:()=>Promise<boolean>;restores:SceneRestores}
interface Selected {saved:StoryDocumentRevision;current:StorySceneDocument}
interface Review extends Selected {intent:SceneRestoreIntent}
const errorKey=(error:unknown)=>error instanceof ApiError&&error.code==='STORY_DOCUMENT_FORMAT_UNSUPPORTED'?'unsupported':error instanceof ApiError&&error.code==='STORY_REVISION_NOT_FOUND'?'missing':'failed'
function selectedText(text:string,start:number,end:number){
    if(start===end)return ''
    const split=(at:number)=>at>0&&at<text.length&&text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff
    return text.slice(split(start)?start-1:start,split(end)?end+1:end)
}
export function NovelRevisionDrawer(props:Props){
    const {t}=useTranslation()
    return props.source?<SceneRevisionDrawer key={props.source.key} {...props} source={props.source}/>:<Drawer open={props.open} onClose={props.onClose} title={t('novelEditor.revisions.title')}><p>{t('novelEditor.revisions.chooseScene')}</p></Drawer>
}
function SceneRevisionDrawer({open,onClose,source,readOnly,beforeWrite,restores}:Props&{source:SceneRevisionSource}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.revisions.'+key,values)
    const [query,setQuery]=useState<StorySceneRevisionQuery>({}),[page,setPage]=useState<StorySceneRevisionPage|null>(null)
    const [selected,setSelected]=useState<Selected|null>(null),[review,setReview]=useState<Review|null>(null)
    const [error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[working,setWorking]=useState(false),[refresh,setRefresh]=useState(0)
    const [confirmed,setConfirmed]=useState<StorySceneRestoreAcknowledgement|null>(null)
    const [selecting,setSelecting]=useState(false),[excerpt,setExcerpt]=useState(''),[copied,setCopied]=useState(false),[clipboardFailed,setClipboardFailed]=useState(false)
    const epoch=useRef(0),flight=useRef(false),copySequence=useRef(0)
    const dateError=Boolean(query.fromDate&&query.throughDate&&query.fromDate>query.throughDate)
    useEffect(()=>{
        if(!open)return
        const current=++epoch.current;let mounted=true
        const active=()=>mounted&&current===epoch.current&&source.isCurrent()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- replace the scoped remote history subscription
        setPage(null);setSelected(null);setReview(null);setError(null);setLoading(true);setWorking(false);setExcerpt('');setCopied(false);setClipboardFailed(false);flight.current=false
        if(dateError){setLoading(false);return()=>{mounted=false}}
        void (async()=>{
            try {if(!source.isCurrent())throw new Error('Scope changed');const value=await source.page(query);if(active())setPage(value)}
            catch(error){if(active())setError(errorKey(error))}
            finally {if(active())setLoading(false)}
        })()
        return()=>{mounted=false;epoch.current=current+1}
    },[source,open,query,refresh,dateError])
    const locked=readOnly||working||restores.hasPending()||Boolean(page?.head.readOnly)
    const stale=error==='changed'||restores.error==='changed'
    const run=async(action:(active:()=>boolean)=>Promise<void>)=>{
        if(flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);setCopied(false)
        const active=()=>current===epoch.current&&source.isCurrent()
        try {if(active())await action(active)}catch(error){if(active())setError(errorKey(error))}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const choose=(item:StoryDocumentRevisionSummary)=>void run(async(active)=>{
        const [saved,current]=await Promise.all([source.detail(item.revision,item.contentHash),source.current()])
        if(active()){copySequence.current++;setSelected({saved,current});setExcerpt('');setSelecting(false);setCopied(false);setClipboardFailed(false)}
    })
    const more=()=>void run(async(active)=>{
        if(!page?.nextBefore)return
        const value=await source.page({...query,before:page.nextBefore})
        if(active()){
            if(value.head.revision!==page.head.revision)setError('newer')
            setPage({...value,items:[...page.items,...value.items]})
        }
    })
    const prepare=()=>void run(async(active)=>{
        if(!selected||locked)return
        restores.clearError()
        if(!await beforeWrite()||!active()){if(active())setError('blocked');return}
        const [saved,current]=await Promise.all([source.detail(selected.saved.revision,selected.saved.contentHash),source.current()])
        if(!active())return
        if(current.inheritance?.readOnly){setError('readOnly');return}
        if(saved.contentHash===current.contentHash){setError('unchanged');return}
        const intent:SceneRestoreIntent={storyId:source.storyId,sceneId:source.sceneId,sceneTitle:current.title,revision:saved.revision,
            write:{requestId:makeRequestId('novel-scene-restore'),expectedRevision:current.revision,expectedContentHash:current.contentHash,sourceContentHash:saved.contentHash}}
        setSelected({saved,current});setReview({saved,current,intent})
    })
    const apply=()=>void run(async(active)=>{
        if(!review||locked||stale)return
        if(!await beforeWrite()||!active()){if(active())setError('blocked');return}
        const head=await source.head()
        if(!active())return
        if(head.readOnly){setError('readOnly');return}
        if(head.revision!==review.current.revision||head.contentHash!==review.current.contentHash){setError('changed');return}
        try{
            const ack=await restores.start(review.intent)
            if(active()){
                if(ack){setConfirmed(ack);setReview(null);setRefresh((value)=>value+1)}else setError('failed')
            }
        }catch(error){if(active())setError(error instanceof ApiError&&['STORY_REVISION_CONFLICT','STORY_REVISION_SOURCE_CHANGED'].includes(error.code??'')?'changed':'failed')}
    })
    const copyText=async(text:string)=>{
        if(!source.isCurrent())return
        const current=epoch.current,sequence=++copySequence.current;setCopied(false);setClipboardFailed(false)
        const active=()=>current===epoch.current&&sequence===copySequence.current&&source.isCurrent()
        try {if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);if(active())setCopied(true)}
        catch{if(active())setClipboardFailed(true)}
    }
    const download=(text:string,extension:string)=>{
        if(!selected||!source.isCurrent())return
        downloadBlob(new Blob([text],{type:'text/plain;charset=utf-8'}),safeFilename(selected.current.title,'scene')+'-revision-'+selected.saved.revision+'.'+extension)
    }
    if(!open)return null
    return <>
        <Drawer open={open} onClose={onClose} title={copy('title')} icon={<Icon icon={History}/>} size="2xl">
            <div className="space-y-4">
                <p className="text-body text-parchment-200">{copy('help')}</p>
                {confirmed&&<Callout role="status">{copy('confirmed',{revision:confirmed.revision,source:confirmed.sourceRevision})}</Callout>}
                {error&&<Callout tone="warning" role="alert">{copy(error)}</Callout>}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={copy('source')}><Select disabled={working} value={query.source??''} onChange={(value)=>setQuery((old)=>({...old,source:value?value as StorySceneRevisionQuery['source']:undefined}))} options={[{value:'',label:copy('allSources')},...STORY_REVISION_SOURCES.map((value)=>({value,label:copy('sources.'+value)}))]}/></Field>
                    <Field label={copy('actor')}><Select disabled={working} value={query.actor??''} onChange={(value)=>setQuery((old)=>({...old,actor:value?value as StorySceneRevisionQuery['actor']:undefined}))} options={[{value:'',label:copy('allActors')},{value:'author',label:copy('actors.author')},{value:'system',label:copy('actors.system')}]}/></Field>
                    <Field label={copy('fromDate')}><Input type="date" value={query.fromDate??''} onChange={(event)=>setQuery((old)=>({...old,fromDate:event.target.value||undefined}))}/></Field>
                    <Field label={copy('throughDate')} error={dateError?copy('dateError'):undefined}><Input type="date" value={query.throughDate??''} onChange={(event)=>setQuery((old)=>({...old,throughDate:event.target.value||undefined}))}/></Field>
                </div>
                <Button variant="secondary" size="sm" disabled={working} onClick={()=>{restores.clearError();setRefresh((value)=>value+1)}}>{copy('refresh')}</Button>
                {loading&&<p role="status">{t('common.loading')}</p>}{working&&<p role="status">{copy('working')}</p>}
                {!loading&&page?.items.length===0&&<p>{copy('empty')}</p>}
                <ol className="space-y-2">{page?.items.map((item)=><li key={item.revision}>
                    <Button variant={selected?.saved.revision===item.revision?'primary':'secondary'} size="sm" disabled={working} onClick={()=>choose(item)}>{copy('revision',{revision:item.revision})} · {copy('sources.'+item.source)}</Button>
                    <p className="mt-1 text-caption text-parchment-400">{item.createdAt.replace('T',' ')} · {copy('actors.'+item.actor)}{item.restoredFrom!==null?' · '+copy('restoredFrom',{revision:item.restoredFrom}):''}</p>
                    {item.schemaVersion!==1&&<Badge>{copy('unsupported')}</Badge>}
                </li>)}</ol>
                {page?.nextBefore&&<Button size="sm" variant="secondary" disabled={working} onClick={more}>{copy('more')}</Button>}
                {selected&&<section className="space-y-4 border-t border-line pt-4" aria-label={copy('comparison')}>
                    <h3 className="font-display text-h3">{copy('revision',{revision:selected.saved.revision})}</h3>
                    <p className="text-caption text-parchment-300">{copy('savedOnly')}</p>
                    <div className="flex flex-wrap gap-2"><Button disabled={locked} onClick={prepare}>{copy('reviewRestore')}</Button>
                        <Button variant="secondary" size="sm" onClick={()=>void copyText(selected.saved.body)}>{copy('copyCheckpoint')}</Button>
                        <Button variant="secondary" size="sm" onClick={()=>{copySequence.current++;setSelecting((value)=>!value);setExcerpt('');setCopied(false)}}>{copy('selectExcerpt')}</Button>
                        <Button variant="secondary" size="sm" onClick={()=>download(selected.saved.body,'md')}>{copy('downloadCheckpoint')}</Button></div>
                    {copied&&<p role="status">{copy('copied')}</p>}{clipboardFailed&&<Callout tone="warning">{copy('clipboardFailed')}</Callout>}
                    {selecting&&<section className="space-y-3"><Field label={copy('excerptHelp')}><Textarea readOnly rows={8} className="font-narrative" value={selected.saved.plainText} onSelect={(event)=>{const input=event.currentTarget;copySequence.current++;setExcerpt(selectedText(input.value,input.selectionStart,input.selectionEnd));setCopied(false)}}/></Field>
                        <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={!excerpt} onClick={()=>void copyText(excerpt)}>{copy('copyExcerpt')}</Button><Button size="sm" variant="secondary" disabled={!excerpt} onClick={()=>download(excerpt,'txt')}>{copy('downloadExcerpt')}</Button></div></section>}
                    <div className="grid gap-4 md:grid-cols-2"><section className="min-w-0"><h4 className="mb-2 font-ui text-body">{copy('previous')}</h4><Markdown content={selected.saved.body}/></section><section className="min-w-0"><h4 className="mb-2 font-ui text-body">{copy('currentRevision',{revision:selected.current.revision})}</h4><Markdown content={selected.current.body}/></section></div>
                </section>}
            </div>
        </Drawer>
        <Modal open={Boolean(review)} title={copy('reviewTitle')} onClose={()=>{if(!working)setReview(null)}} size="lg" footer={<>
            <Button variant="secondary" disabled={working} onClick={()=>setReview(null)}>{t('common.cancel')}</Button>
            {stale?<Button disabled={locked} onClick={prepare}>{copy('refreshReview')}</Button>:<Button disabled={locked||!review} onClick={apply}>{copy('restore')}</Button>}
        </>}>
            {review&&<div className="space-y-4"><p>{copy('restoreHelp',{source:review.saved.revision,current:review.current.revision})}</p>
                {(error||restores.error)&&<Callout tone="warning" role="alert">{copy(error??restores.error!)}</Callout>}
                <div className="grid gap-4 md:grid-cols-2"><section className="min-w-0"><h4>{copy('currentRevision',{revision:review.current.revision})}</h4><Markdown content={review.current.body}/></section><section className="min-w-0"><h4>{copy('after')}</h4><Markdown content={review.saved.body}/></section></div>
            </div>}
        </Modal>
    </>
}
