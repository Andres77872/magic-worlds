import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorySnapshotDetail,StorySnapshotAnnotationIndex,StorySnapshotAnnotationPage,StorySnapshotAnnotationDetail,StorySnapshotAnnotationQuery } from '@/shared'
import { Badge,Button,Callout,Chip,Field,Select } from '@/ui/primitives'
import { resolveAnnotationRange,annotationContext } from '@/shared/storyAnnotationAnchors'
import { documentText } from '@/shared/storyDocument'
import { downloadBlob,safeFilename } from '@/utils/download'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'

interface Props {snapshot:StorySnapshotDetail;source:StorySnapshotSource}
type Passage=ReturnType<typeof annotationContext>
export function NovelSnapshotNotes({snapshot,source}:Props){
    const {t}=useTranslation(),[kind,setKind]=useState<'note'|'bookmark'>('note')
    return <div className="space-y-3"><div className="flex flex-wrap gap-2" aria-label={t('novelEditor.bookmarks.kindLabel')}><Chip active={kind==='note'} onClick={()=>setKind('note')}>{t('novelEditor.annotations.title')}</Chip><Chip active={kind==='bookmark'} onClick={()=>setKind('bookmark')}>{t('novelEditor.bookmarks.title')}</Chip></div>
        <SnapshotAnnotations key={snapshot.id+':'+snapshot.manifestHash+':'+kind} snapshot={snapshot} source={source} kind={kind}/></div>
}
function SnapshotAnnotations({snapshot,source,kind}:Props&{kind:'note'|'bookmark'}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t((kind==='bookmark'?'novelEditor.bookmarks.captured.':'novelEditor.snapshots.personalNotes.')+key,values)
    const [page,setPage]=useState<StorySnapshotAnnotationPage|null>(null),[detail,setDetail]=useState<StorySnapshotAnnotationDetail|null>(null)
    const [query,setQuery]=useState<StorySnapshotAnnotationQuery>(()=>kind==='bookmark'?{kind}:{}),[passage,setPassage]=useState<Passage|null>(null)
    const [working,setWorking]=useState(false),[error,setError]=useState(false),[copied,setCopied]=useState(false)
    const epoch=useRef(0),flight=useRef(false)
    useEffect(()=>()=>{epoch.current++},[])
    const active=(value:number)=>epoch.current===value&&source.isCurrent()
    const collection=snapshot.manifest.annotations
    const entries=collection?.notes.filter((item)=>(item.kind??'note')===kind)??[]
    const load=async(next:StorySnapshotAnnotationQuery={},more=false)=>{
        if(flight.current||!source.isCurrent())return
        const current=epoch.current;flight.current=true;setWorking(true);setError(false)
        if(!more){setQuery(next);setPage(null);setDetail(null);setPassage(null)}
        try{const value=await source.notes(snapshot,next);if(active(current))setPage(more&&page?{...value,items:[...page.items,...value.items]}:value)}
        catch{if(active(current))setError(true)}
        finally{if(active(current)){flight.current=false;setWorking(false)}}
    }
    const read=async(index:StorySnapshotAnnotationIndex)=>{
        if(flight.current||!source.isCurrent())return
        const current=epoch.current;flight.current=true;setWorking(true);setError(false);setDetail(null);setPassage(null);setCopied(false)
        try{const value=await source.note(snapshot,index);if(active(current))setDetail(value)}
        catch{if(active(current))setError(true)}
        finally{if(active(current)){flight.current=false;setWorking(false)}}
    }
    const readPassage=async()=>{
        const anchor=detail?.note.anchor
        if(!anchor||flight.current||!source.isCurrent())return
        const scene=snapshot.manifest.chapters.flatMap((chapter)=>chapter.scenes).find((item)=>item.id===anchor.sceneId)
        if(!scene){setError(true);return}
        const current=epoch.current;flight.current=true;setWorking(true);setError(false);setPassage(null)
        try{
            const value=await source.scene(snapshot.id,scene,snapshot.manifestHash),range=resolveAnnotationRange(value.scene,anchor)
            if(!range)throw new Error('Captured passage integrity mismatch')
            if(active(current))setPassage(annotationContext(documentText(value.scene.document),range))
        }catch{if(active(current))setError(true)}
        finally{if(active(current)){flight.current=false;setWorking(false)}}
    }
    const copyNote=async()=>{
        if(!detail||!source.isCurrent())return
        const current=epoch.current
        try{await navigator.clipboard.writeText(detail.note.body);if(active(current))setCopied(true)}catch{if(active(current))setError(true)}
    }
    const title=(id:string)=>snapshot.manifest.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===id)?.title??id
    return <section className="space-y-3 rounded-lg border border-line p-4" aria-label={copy('title')}>
        <h3 className="font-display text-h3">{copy('title')}</h3>
        {!collection?<p className="text-body text-parchment-200">{copy('notCaptured')}</p>:<>
            <p className="text-body text-parchment-200">{copy('count',{count:entries.length})}</p>
            <p className="text-caption text-parchment-300">{copy('help')}</p>
            {entries.length===0?<p>{copy('empty')}</p>:<>
                {!page&&<Button size="sm" variant="secondary" disabled={working} onClick={()=>void load(query)}>{copy('read')}</Button>}
                {page&&<div className="flex flex-wrap gap-3">
                    <Field label={copy('state')}><Select value={query.state??'all'} disabled={working} options={(kind==='bookmark'?['all','open','trashed']:['all','open','resolved','trashed']).map((value)=>({value,label:copy('states.'+value)}))} onChange={(value)=>void load({...query,state:value==='all'?undefined:value as StorySnapshotAnnotationQuery['state']})}/></Field>
                    <Field label={copy('attachment')}><Select value={query.anchorState??'all'} disabled={working} options={['all','attached','orphaned'].map((value)=>({value,label:copy('anchors.'+value)}))} onChange={(value)=>void load({...query,anchorState:value==='all'?undefined:value as StorySnapshotAnnotationQuery['anchorState']})}/></Field>
                </div>}
                {page?.items.length===0&&<p>{copy('noMatches')}</p>}
                <ol className="space-y-2">{page?.items.map((item)=><li key={item.id} className="space-y-2 rounded-md border border-line p-3">
                    <div className="flex flex-wrap gap-2"><Badge>{copy('states.'+item.state)}</Badge><Badge>{copy('anchors.'+item.anchorState)}</Badge><span className="text-caption text-parchment-300">{title(item.sceneId)}</span></div>
                    <p className="whitespace-pre-wrap text-body text-parchment-200">{item.bodyPreview}</p>
                    <Button size="sm" variant="secondary" disabled={working} onClick={()=>void read(item)}>{copy('open')}</Button>
                </li>)}</ol>
                {page?.nextAfter&&<Button size="sm" variant="secondary" disabled={working} onClick={()=>void load({...query,after:page.nextAfter!},true)}>{copy('more')}</Button>}
            </>}
            {detail&&<section className="space-y-3 border-t border-line pt-3" aria-label={copy('detail')}>
                <h4 className="font-ui text-body">{title(detail.note.sceneId)}</h4>
                <div className="flex flex-wrap gap-2"><Badge>{copy('states.'+detail.note.state)}</Badge><Badge>{copy('anchors.'+detail.note.anchorState)}</Badge></div>
                <p className="whitespace-pre-wrap text-body text-parchment-100">{detail.note.body}</p>
                <p className="text-caption text-parchment-300">{copy('recorded',{at:detail.recordedAt.replace('T',' ')})}</p>
                <blockquote className="whitespace-pre-wrap border-l border-line pl-3 font-narrative text-parchment-200">{detail.note.lastAnchor.quote||copy('cursorPoint')}</blockquote>
                {detail.note.anchor?<Button size="sm" variant="secondary" disabled={working} onClick={()=>void readPassage()}>{copy('passage')}</Button>:<p className="text-caption text-parchment-300">{copy('orphan')}</p>}
                {passage&&<p className="whitespace-pre-wrap font-narrative text-body text-parchment-200">{passage.beforeCut?'…':''}{passage.before}<mark className="bg-ember-500/15 text-parchment-50" aria-label={!passage.quote?copy('cursorPoint'):undefined}>{passage.quote||'│'}</mark>{passage.after}{passage.afterCut?'…':''}</p>}
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>void copyNote()}>{copy('copy')}</Button><Button size="sm" variant="secondary" onClick={()=>{if(source.isCurrent())downloadBlob(new Blob([detail.note.body],{type:'text/plain;charset=utf-8'}),safeFilename(snapshot.name+'-'+detail.note.id,'snapshot-note')+'.txt')}}>{copy('download')}</Button></div>
                {copied&&<p role="status">{copy('copied')}</p>}
            </section>}
        </>}
        {working&&<p role="status">{t('common.loading')}</p>}
        {error&&<Callout tone="warning" role="alert">{copy('failed')}</Callout>}
    </section>
}
