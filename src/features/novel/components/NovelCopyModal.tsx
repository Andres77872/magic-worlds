import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryCopyOptions,StoryCopyPreview } from '@/shared'
import { defaultStoryCopyOptions } from '@/infrastructure/api/storyCopyContract'
import { Button,Callout,Field,Input,Modal,SwitchRow } from '@/ui/primitives'
import { makeRequestId } from '@/utils/uuid'
import type { NovelCopies } from '../hooks/useNovelCopies'

export function NovelCopyModal({source,copies,onClose,onCopied}:{source:{id:string;title:string};copies:NovelCopies;onClose:()=>void;onCopied?:()=>void}){
    const {t}=useTranslation()
    const text=(key:string,options?:Record<string,unknown>)=>t('novelEditor.copyNovel.'+key,options)
    const [title,setTitle]=useState(()=>t('novelEditor.copyNovel.defaultTitle',{title:source.title}).slice(0,255))
    const [options,setOptions]=useState<StoryCopyOptions>({...defaultStoryCopyOptions})
    const [includeComments,setIncludeComments]=useState(true)
    const [includeBookmarks,setIncludeBookmarks]=useState(false)
    const [snapshot,setSnapshot]=useState<{sourceId:string;preview:StoryCopyPreview|null;loading:boolean;error:string|null}>({sourceId:source.id,preview:null,loading:true,error:null})
    const {preview,loading,error}=snapshot.sourceId===source.id?snapshot:{preview:null,loading:true,error:null}
    const [busy,setBusy]=useState(false)
    const [reload,setReload]=useState(0)
    const previewRef=useRef(copies.preview)
    useLayoutEffect(()=>{previewRef.current=copies.preview},[copies.preview])
    const mounted=useRef(true)
    useEffect(()=>{
        mounted.current=true;let current=true
        previewRef.current(source.id).then((value)=>{if(current)setSnapshot({sourceId:source.id,preview:value,loading:false,error:null})})
            .catch(()=>{if(current)setSnapshot({sourceId:source.id,preview:null,loading:false,error:'failed'})})
        return()=>{current=false;mounted.current=false}
    },[source.id,reload])
    const counts=preview?.variants.find((item)=>item.includeArchived===options.includeArchived&&item.includeTrash===options.includeTrash&&item.includeContext===options.includeContext)?.counts
    const comments=preview?.variants.find((item)=>item.includeArchived===options.includeArchived&&item.includeTrash===options.includeTrash&&item.includeContext===options.includeContext)?.comments
    const bookmarks=preview?.variants.find((item)=>item.includeArchived===options.includeArchived&&item.includeTrash===options.includeTrash&&item.includeContext===options.includeContext)?.bookmarks
    const blocked=copies.hasPending(source.id)
    async function create(){
        if(!preview||busy||blocked||!title.trim()||!counts?.chapters)return
        setBusy(true);setSnapshot((old)=>({...old,error:null}))
        try{
            const ack=await copies.start(preview,{requestId:makeRequestId('novel-copy'),expectedSourceVersion:preview.sourceVersion,title:title.trim(),options:{...options},
                ...(preview.annotationRevision!==undefined?{includeComments,sourceAnnotationRevision:preview.annotationRevision,...(bookmarks!==undefined?{includeBookmarks}:{})}:{})})
            if(ack&&mounted.current){onCopied?.();onClose()}
        }catch(error){if(mounted.current){const changed=error instanceof ApiError&&error.code==='STORY_COPY_SOURCE_CHANGED';setSnapshot((old)=>({...old,error:changed?'changed':'failed',preview:changed?null:old.preview}))}}
        finally{if(mounted.current)setBusy(false)}
    }
    return <Modal open title={text('title')} onClose={onClose} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('close')}</Button>
        <Button variant="primary" disabled={busy||loading||blocked||!preview||!counts?.chapters||!title.trim()} aria-busy={busy} onClick={()=>void create()}>{text('create')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-300">{text('help')}</p>
            <Field label={text('name')}><Input value={title} maxLength={255} disabled={busy||blocked} onChange={(event)=>setTitle(event.target.value)}/></Field>
            {(['includeNotes','includeContext','includeArchived','includeTrash'] as const).map((key)=><SwitchRow key={key} label={text(key)} description={text(key+'Help')} checked={options[key]} disabled={busy||blocked} onChange={(value)=>setOptions((old)=>({...old,[key]:value}))}/>)}
            {preview?.annotationRevision!==undefined&&<SwitchRow label={text('includeComments')} description={text('includeCommentsHelp')} checked={includeComments} disabled={busy||blocked} onChange={setIncludeComments}/>}
            {bookmarks!==undefined&&<SwitchRow label={t('novelEditor.bookmarks.include')} description={t('novelEditor.bookmarks.includeHelp')} checked={includeBookmarks} disabled={busy||blocked} onChange={setIncludeBookmarks}/>}
            {loading&&<p role="status">{text('loading')}</p>}
            {counts&&<p role="status">{text('counts',{...counts})}</p>}
            {comments!==undefined&&<p role="status">{text('commentCount',{count:includeComments?comments:0})}</p>}
            {bookmarks!==undefined&&<p role="status">{t('novelEditor.bookmarks.copyCount',{count:includeBookmarks?bookmarks:0})}</p>}
            {counts&&!counts.chapters&&<Callout tone="warning">{text('empty')}</Callout>}
            {blocked&&<Callout tone="warning">{text('pending')}</Callout>}
            {(error||!loading&&!preview)&&<Callout tone="warning" role="alert">{text(error??'blocked')} <Button variant="secondary" size="sm" disabled={busy||blocked} onClick={()=>{setSnapshot({sourceId:source.id,preview:null,loading:true,error:null});setReload((v)=>v+1)}}>{text('refresh')}</Button></Callout>}
        </div>
    </Modal>
}
