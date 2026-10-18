import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline,StorySceneDocument,StorySnapshotComparison,StorySnapshotCreateOperation,StorySnapshotPage,StorySnapshotPreview,StorySnapshotSummary,StoryStructureOperation,StorySnapshotRestoreOptions } from '@/shared'
import { Badge,Button,Callout,Drawer,Field,Input,Modal,Textarea } from '@/ui/primitives'
import { Markdown } from '@/ui/components/Markdown'
import { ApiError } from '@/infrastructure/api'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { manuscriptSnapshotChanges,snapshotScenes } from '../utils/manuscriptSnapshots'
import { NovelSnapshotRestoreReview } from './NovelSnapshotRestoreReview'
import { NovelSnapshotNotes } from './NovelSnapshotNotes'

interface Props {
    open:boolean
    onClose:()=>void
    source:StorySnapshotSource
    structureRevision:number
    readOnly:boolean
    busy:boolean
    pendingOperation?:StoryStructureOperation|null
    operationError?:string|null
    clearOperationError?:()=>void
    beforeWrite:()=>Promise<boolean>
    operate:(operation:StoryStructureOperation)=>Promise<StoryOutline|null>
    recover:()=>Promise<StoryOutline|null>
}
interface CaptureReview {preview:StorySnapshotPreview;operation:StorySnapshotCreateOperation}
interface SceneReading {saved:StorySceneDocument;current:StorySceneDocument|null;warning:boolean}
const readFailure=(error:unknown)=>error instanceof ApiError&&error.code==='STORY_SNAPSHOT_FORMAT_UNSUPPORTED'?'unsupported':error instanceof ApiError&&error.code==='STORY_SNAPSHOT_CHECKPOINT_MISSING'?'checkpointMissing':error instanceof ApiError&&error.code==='STORY_SNAPSHOT_TOO_LARGE'?'tooLarge':'failed'
export function NovelSnapshotDrawer(props:Props) {
    return <ScopedSnapshotDrawer key={props.source.key} {...props}/>
}
function ScopedSnapshotDrawer({open,onClose,source,structureRevision,readOnly,busy,pendingOperation,operationError,clearOperationError,beforeWrite,operate,recover}:Props) {
    const {t}=useTranslation()
    const copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.snapshots.'+key,values)
    const [page,setPage]=useState<StorySnapshotPage|null>(null)
    const [selected,setSelected]=useState<StorySnapshotComparison|null>(null)
    const [reading,setReading]=useState<SceneReading|null>(null)
    const [name,setName]=useState(''),[note,setNote]=useState('')
    const [review,setReview]=useState<CaptureReview|null>(null)
    const [restoreOpen,setRestoreOpen]=useState(false),[restoreChoices,setRestoreChoices]=useState<Record<number,StorySnapshotRestoreOptions>>({})
    const [loading,setLoading]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState<string|null>(null)
    const [refresh,setRefresh]=useState(0),[visible,setVisible]=useState(50)
    const epoch=useRef(0),flight=useRef(false)
    useEffect(()=>{
        if(!open)return
        const current=++epoch.current;let mounted=true
        const active=()=>mounted&&current===epoch.current&&source.isCurrent()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- replace the opened scoped snapshot subscription
        setLoading(true);setPage(null);setSelected(null);setReading(null);setReview(null);setRestoreOpen(false);setError(null);setWorking(false);flight.current=false
        void (async()=>{
            try {if(!source.isCurrent())throw new Error('Scope changed');const value=await source.list();if(active())setPage(value)}
            catch (error){if(active())setError(readFailure(error))}
            finally {if(active())setLoading(false)}
        })()
        return()=>{mounted=false;epoch.current=current+1}
    },[open,source,refresh])
    const pending=pendingOperation?.op==='create_snapshot'?pendingOperation:null
    const title=pending?.title??name,description=pending?pending.note??'':note
    const stale=Boolean(review&&review.operation.sourceStructureRevision!==structureRevision)||operationError==='STORY_SNAPSHOT_SOURCE_CHANGED'||operationError==='STORY_SNAPSHOT_ANNOTATIONS_CHANGED'||operationError==='STORY_STRUCTURE_CONFLICT'
    const locked=readOnly||busy||working||Boolean(pendingOperation)
    const validName=Boolean(title.trim())&&Array.from(title).length<=255
    const validNote=Array.from(description).length<=2000
    const failure=stale?'changed':operationError==='STORY_SNAPSHOT_TOO_LARGE'?'tooLarge':operationError==='STORY_SNAPSHOT_CHECKPOINT_MISSING'?'checkpointMissing':error
    const listMore=async()=>{
        if(!page?.nextBefore||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        try {const value=await source.list(page.nextBefore);if(current===epoch.current&&source.isCurrent())setPage({...value,items:[...page.items,...value.items]})}
        catch (error){if(current===epoch.current&&source.isCurrent())setError(readFailure(error))}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const choose=async(item:StorySnapshotSummary)=>{
        if(flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);setReading(null)
        try {
            const value=await source.compare(item.id)
            if(value.manifestHash!==item.manifestHash)throw new Error('Snapshot changed')
            if(current===epoch.current&&source.isCurrent()){setSelected(value);setVisible(50)}
        }catch (error){if(current===epoch.current&&source.isCurrent())setError(readFailure(error))}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const readScene=async(id:string)=>{
        if(!selected||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);setReading(null)
        try {
            const target=selected.current.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===id)
            const frozen=selected.manifest.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===id)
            if(!frozen)throw new Error('Snapshot scene missing')
            const [saved,latest]=await Promise.allSettled([source.scene(selected.id,frozen,selected.manifestHash),target?source.currentScene(id):Promise.resolve(null)])
            if(saved.status!=='fulfilled')throw saved.reason
            const live=latest.status==='fulfilled'?latest.value:null
            const matches=Boolean(live&&target&&live.revision===target.revision&&live.metadataRevision===target.metadataRevision&&live.contentHash===target.contentHash&&live.chapterId===target.chapterId)
            if(current===epoch.current&&source.isCurrent())setReading({saved:saved.value.scene,current:matches?live:null,warning:Boolean(target&&!matches)})
        }catch (error){if(current===epoch.current&&source.isCurrent())setError(readFailure(error))}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const prepare=async()=>{
        if(locked||!validName||!validNote||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);clearOperationError?.()
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const preview=await source.preview()
            if(!preview.annotations)throw new Error('Personal-note capture preview is unavailable')
            if(current===epoch.current&&source.isCurrent())setReview({preview,operation:{op:'create_snapshot',title:title.trim(),note:description===''?null:description,expectedSourceVersion:preview.sourceVersion,sourceStructureRevision:preview.structureRevision,sourceAnnotationRevision:preview.annotations.revision}})
        }catch (error){if(current===epoch.current&&source.isCurrent())setError(readFailure(error))}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const commit=async()=>{
        if(!review||locked||stale||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const result=await operate(review.operation)
            if(current!==epoch.current||!source.isCurrent())return
            if(!result){setError('failed');return}
            setReview(null);setName('');setNote('');setRefresh((value)=>value+1)
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const recoverCapture=async()=>{
        if(!pendingOperation||flight.current)return null
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        try {const result=await recover();if(current===epoch.current&&source.isCurrent()){if(result){setReview(null);setRestoreOpen(false);setRefresh((value)=>value+1)}else setError('failed')}return result}
        catch {if(current===epoch.current&&source.isCurrent())setError('failed');return null}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    if(!open)return null
    const changes=selected?manuscriptSnapshotChanges(selected.manifest,selected.current):[]
    const scenes=selected?snapshotScenes(selected.manifest):[]
    return <>
        <Drawer open={open} onClose={onClose} title={copy('title')} size="2xl">
            <div className="space-y-5">
                <p className="text-body text-parchment-200">{copy('help')}</p>
                {working&&<p role="status" className="text-caption text-parchment-200">{copy('working')}</p>}
                {failure&&<Callout tone="warning" role="alert">{copy(failure)}</Callout>}
                {pendingOperation&&<Callout tone="warning" role="status"><p>{copy('pending')}</p><Button size="sm" variant="secondary" disabled={working||busy} onClick={()=>void recoverCapture()}>{copy('recover')}</Button></Callout>}
                <section className="space-y-3" aria-label={copy('create')}>
                    <h2 className="font-display text-h3">{copy('create')}</h2>
                    <Field label={copy('name')} error={Array.from(title).length>255?copy('nameLimit'):undefined}><Input value={title} disabled={locked} onChange={(event)=>setName(event.target.value)}/></Field>
                    <Field label={copy('note')} error={!validNote?copy('noteLimit'):undefined}><Textarea value={description} disabled={locked} onChange={(event)=>setNote(event.target.value)}/></Field>
                    <Button disabled={locked||!validName||!validNote} onClick={()=>void prepare()}>{copy('review')}</Button>
                </section>
                <section className="space-y-3 border-t border-line pt-4" aria-label={copy('saved')}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-h3">{copy('saved')}</h2><Button variant="secondary" size="sm" disabled={working} onClick={()=>{clearOperationError?.();setRefresh((value)=>value+1)}}>{copy('refresh')}</Button></div>
                    {loading&&<p role="status">{t('common.loading')}</p>}
                    {!loading&&page?.items.length===0&&<p>{copy('empty')}</p>}
                    <ol className="space-y-2">{page?.items.map((item)=><li key={item.id}>
                        <Button variant={selected?.id===item.id?'primary':'secondary'} size="sm" disabled={working} className="h-auto max-w-full whitespace-normal text-left" onClick={()=>void choose(item)}>{item.name}</Button>
                        <p className="mt-1 text-caption text-parchment-400">{item.createdAt.replace('T',' ')} · {copy('counts',{...item.counts})}</p>
                    </li>)}</ol>
                    {page?.nextBefore&&<Button variant="secondary" size="sm" disabled={working} onClick={()=>void listMore()}>{copy('more')}</Button>}
                </section>
                {selected&&<section className="space-y-4 border-t border-line pt-4" aria-label={copy('comparison')}>
                    <h2 className="font-display text-h3">{selected.name}</h2>
                    <p className="text-caption text-parchment-300">{copy('savedAs',{title:selected.manifest.novel.title})}</p>
                    {selected.note&&<p className="whitespace-pre-wrap text-body text-parchment-200">{selected.note}</p>}
                    <NovelSnapshotNotes key={source.key+':'+selected.id+':'+selected.manifestHash} snapshot={selected} source={source}/>
                    <p className="text-caption text-parchment-300">{copy('compareHelp')}</p>
                    <Button variant="secondary" disabled={locked} onClick={()=>setRestoreOpen(true)}>{copy('restore.open')}</Button>
                    {!changes.length?<p>{copy('unchanged')}</p>:<ol className="space-y-2">{changes.slice(0,visible).map((item)=><li key={item.kind+':'+item.id} className="rounded-md border border-line p-3">
                        <p className="font-ui text-body">{copy('kinds.'+item.kind)} · {item.title}</p><div className="mt-2 flex flex-wrap gap-2">{item.fields.map((field)=><Badge key={field}>{copy('changes.'+field)}</Badge>)}</div>
                    </li>)}</ol>}
                    {changes.length>visible&&<Button variant="secondary" size="sm" onClick={()=>setVisible((value)=>value+50)}>{copy('showMore')}</Button>}
                    <h3 className="font-display text-h3">{copy('scenes')}</h3>
                    <ol className="space-y-2">{scenes.slice(0,visible).map(({part,chapter,scene})=><li key={scene.id} className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" disabled={working} onClick={()=>void readScene(scene.id)}>{chapter.title} · {scene.title}</Button>
                        {(scene.trashedAt||chapter.trashedAt||part?.trashedAt)?<Badge>{copy('inTrash')}</Badge>:(scene.status==='archived'||chapter.status==='archived'||part?.status==='archived')&&<Badge>{copy('archived')}</Badge>}
                    </li>)}</ol>
                    {scenes.length>visible&&<Button size="sm" variant="secondary" onClick={()=>setVisible((value)=>value+50)}>{copy('moreScenes')}</Button>}
                    {reading&&<section className="space-y-3" aria-label={copy('sceneReading')}>
                        <h3 className="font-display text-h3">{reading.saved.title}</h3>
                        {reading.warning&&<Callout tone="warning">{copy('currentChanged')}</Callout>}
                        <div className="grid gap-4 md:grid-cols-2"><section className="min-w-0"><h4 className="mb-2 font-ui text-body">{copy('snapshotText')}</h4><Markdown content={reading.saved.body}/>{reading.saved.details.notes&&<p className="mt-3 whitespace-pre-wrap text-caption text-parchment-300">{copy('savedNotes')}: {reading.saved.details.notes}</p>}</section>
                            <section className="min-w-0"><h4 className="mb-2 font-ui text-body">{copy('currentText')}</h4>{reading.current?<><Markdown content={reading.current.body}/>{reading.current.details.notes&&<p className="mt-3 whitespace-pre-wrap text-caption text-parchment-300">{copy('currentNotes')}: {reading.current.details.notes}</p>}</>:<p>{copy('currentUnavailable')}</p>}</section></div>
                        <h4 className="font-ui text-body">{copy('pins')}</h4><ul className="space-y-2">{reading.saved.activeCardRefs.map((ref)=><li key={ref.id} className="text-caption text-parchment-200">{ref.snapshot.name??ref.snapshot.alias??ref.cardId} · {ref.snapshot.source_card_version_number!==undefined&&ref.snapshot.source_card_version_number!==null?copy('version',{number:ref.snapshot.source_card_version_number}):copy('localPin')} · {copy(ref.removedAt?'removed':ref.enabled?'enabled':'disabled')}</li>)}</ul>
                    </section>}
                </section>}
            </div>
        </Drawer>
        <Modal open={Boolean(review)&&open} onClose={()=>{if(!working)setReview(null)}} title={copy('reviewTitle')} size="lg" footer={<>
            <Button variant="secondary" disabled={working} onClick={()=>setReview(null)}>{t('common.cancel')}</Button>
            {stale?<Button disabled={locked} onClick={()=>void prepare()}>{copy('refreshReview')}</Button>:<Button disabled={locked||!review} onClick={()=>void commit()}>{copy('save')}</Button>}
        </>}>
            {review&&<div className="space-y-3"><h3 className="font-display text-h3">{review.operation.title}</h3>{review.operation.note&&<p className="whitespace-pre-wrap">{review.operation.note}</p>}
                <p>{copy('counts',{...review.preview.counts})}</p><p>{copy('annotationCount',{count:review.preview.annotations?.count??0})}</p><p className="text-body text-parchment-200">{copy('reviewHelp')}</p>
                {(failure||pendingOperation)&&<Callout tone="warning" role={pendingOperation?'status':'alert'}>{copy(pendingOperation?'pending':failure!)}</Callout>}
            </div>}
        </Modal>
        {selected&&<NovelSnapshotRestoreReview key={source.key+':'+selected.id} open={restoreOpen} onClose={()=>setRestoreOpen(false)} onRestored={()=>{setRestoreOpen(false);setRefresh((value)=>value+1)}}
            snapshot={selected} source={source} structureRevision={structureRevision} readOnly={readOnly} busy={busy} pendingOperation={pendingOperation} operationError={operationError}
            clearOperationError={clearOperationError} beforeWrite={beforeWrite} operate={operate} recover={recoverCapture} initialOptions={restoreChoices[selected.id]}
            onOptionsChange={(value)=>setRestoreChoices((previous)=>({...previous,[selected.id]:value}))}/>}
    </>
}
