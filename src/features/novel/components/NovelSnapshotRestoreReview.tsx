import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline,StorySceneDocument,StorySnapshotComparison,StorySnapshotRestoreChange,StorySnapshotRestoreOperation,StorySnapshotRestoreOptions,StorySnapshotRestorePreview,StoryStructureOperation } from '@/shared'
import { Button,Callout,Field,Modal,Select,SwitchRow } from '@/ui/primitives'
import { Markdown } from '@/ui/components/Markdown'
import { ApiError } from '@/infrastructure/api'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { snapshotRestoreItems } from '@/infrastructure/api/storySnapshotContract'
import { restoreFieldChanges,restoreFieldLabel,restoreReadableValue,restoreRelatedValue } from '../utils/manuscriptRestoreReview'
import { NovelCoverPreview } from './NovelCoverField'

interface Props {
    open:boolean;onClose:()=>void;onRestored:()=>void;snapshot:StorySnapshotComparison;source:StorySnapshotSource
    structureRevision:number;readOnly:boolean;busy:boolean;pendingOperation?:StoryStructureOperation|null;operationError?:string|null
    clearOperationError?:()=>void;beforeWrite:()=>Promise<boolean>;operate:(operation:StoryStructureOperation)=>Promise<StoryOutline|null>;recover:()=>Promise<StoryOutline|null>
    initialOptions?:StorySnapshotRestoreOptions;onOptionsChange?:(value:StorySnapshotRestoreOptions)=>void
}
const defaults:StorySnapshotRestoreOptions={text:true,details:true,organization:true,context:true,laterUnits:'keep'}
export function NovelSnapshotRestoreReview({open,onClose,onRestored,snapshot,source,structureRevision,readOnly,busy,pendingOperation,operationError,clearOperationError,beforeWrite,operate,recover,initialOptions,onOptionsChange}:Props) {
    const {t}=useTranslation();const copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.snapshots.restore.'+key,values)
    const [options,setOptions]=useState<StorySnapshotRestoreOptions>(initialOptions??defaults)
    const [review,setReview]=useState<StorySnapshotRestorePreview|null>(null),[error,setError]=useState<string|null>(null)
    const [working,setWorking]=useState(false),[visible,setVisible]=useState(50),[selected,setSelected]=useState<StorySnapshotRestoreChange|null>(null)
    const [reading,setReading]=useState<{saved:StorySceneDocument;current:StorySceneDocument}|null>(null)
    const epoch=useRef(0),flight=useRef(false)
    useEffect(()=>{
        const version=++epoch.current
        // eslint-disable-next-line react-hooks/set-state-in-effect -- replace the opened scoped review, retaining only unsent choices
        setReview(null);setReading(null);setSelected(null);setError(null);setWorking(false);flight.current=false
        return()=>{epoch.current=version+1}
    },[open,source,snapshot.id])
    const pending=pendingOperation?.op==='restore_snapshot'?pendingOperation:null
    const choices=pending?.options??options
    const locked=working||busy||readOnly||Boolean(pendingOperation)
    const stale=error==='changed'||Boolean(review&&review.structureRevision!==structureRevision)||operationError==='STORY_SNAPSHOT_SOURCE_CHANGED'||operationError==='STORY_STRUCTURE_CONFLICT'
    const change=(next:StorySnapshotRestoreOptions)=>{setOptions(next);onOptionsChange?.(next);setReview(null);setSelected(null);setReading(null);setError(null)}
    const prepare=async()=>{
        if(locked||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);clearOperationError?.()
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const value=await source.restorePreview(snapshot.id,{...options})
            if(value.manifestHash!==snapshot.manifestHash)throw new Error('Snapshot changed')
            if(current===epoch.current&&source.isCurrent()){setReview(value);setSelected(null);setReading(null);setVisible(50)}
        }catch(error){if(current===epoch.current&&source.isCurrent())setError(error instanceof ApiError?error.code??'failed':'failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const commit=async()=>{
        if(!review?.canRestore||locked||stale||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        const operation:StorySnapshotRestoreOperation={op:'restore_snapshot',snapshotId:review.snapshotId,manifestHash:review.manifestHash,expectedSourceVersion:review.sourceVersion,sourceStructureRevision:review.structureRevision,options:{...review.options}}
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const result=await operate(operation)
            if(current!==epoch.current||!source.isCurrent())return
            if(result)onRestored();else setError('failed')
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const inspect=async(item:StorySnapshotRestoreChange)=>{
        setSelected(item);setReading(null);setError(null)
        if(item.kind!=='scene'||!item.fields.includes('contentHash')||!review||flight.current)return
        const frozen=snapshot.manifest.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===item.id)
        const compared=review.current.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===item.id)
        if(!frozen||!compared)return
        const current=epoch.current;flight.current=true;setWorking(true)
        try {
            const [saved,live]=await Promise.all([source.scene(snapshot.id,frozen,snapshot.manifestHash),source.currentScene(item.id)])
            if(live.revision!==compared.revision||live.metadataRevision!==compared.metadataRevision||live.contentHash!==compared.contentHash||live.chapterId!==compared.chapterId)throw new Error('Current scene changed')
            if(current===epoch.current&&source.isCurrent())setReading({saved:saved.scene,current:live})
        }catch {if(current===epoch.current&&source.isCurrent())setError('changed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    if(!open)return null
    const currentItems=review?snapshotRestoreItems(review.current):new Map(),targetItems=review?snapshotRestoreItems(review.target):new Map()
    const fields=selected?restoreFieldChanges(currentItems.get(selected.kind+':'+selected.id)??{},targetItems.get(selected.kind+':'+selected.id)??{},selected.fields.filter((key)=>key!=='contentHash')):[]
    const message=stale?'changed':error
    const fieldName=(key:string)=>key.split('.').map((part)=>t('novelEditor.snapshots.restore.fields.'+part,{defaultValue:restoreFieldLabel(part)})).join(' · ')
    const readable=(key:string,value:unknown,after:boolean)=>{
        if(typeof value==='boolean')return copy(value?'yes':'no')
        if(key==='status'&&typeof value==='string')return t('novelEditor.structure.statuses.'+value)
        if(key==='order'&&typeof value==='number')return String(value+1)
        return restoreReadableValue(review?restoreRelatedValue(key,value,after?review.target:review.current):value)
    }
    return <Modal open={open} onClose={()=>{if(!working)onClose()}} title={copy('title',{name:snapshot.name})} size="lg" footer={<>
        <Button variant="secondary" disabled={working} onClick={onClose}>{t('common.cancel')}</Button>
        {review&&!stale?<Button disabled={locked||!review.canRestore} onClick={()=>void commit()}>{copy('apply')}</Button>:<Button disabled={locked||!Object.values(choices).some((value)=>value===true)&&choices.laterUnits==='keep'} onClick={()=>void prepare()}>{copy(review?'refresh':'review')}</Button>}
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{copy('help')}</p>
            {(['text','details','organization','context'] as const).map((key)=><SwitchRow key={key} label={copy('options.'+key)} description={copy('optionHelp.'+key)} checked={choices[key]} onChange={(value)=>change({...options,[key]:value})} disabled={locked}/>)}
            <Field label={copy('laterLabel')} helper={copy('laterHelp')}><Select value={choices.laterUnits} disabled={locked} onChange={(value)=>change({...options,laterUnits:value==='trash'?'trash':'keep'})} options={[{value:'keep',label:copy('keep')},{value:'trash',label:copy('trash')}]}/></Field>
            {working&&<p role="status">{copy('working')}</p>}
            {message&&<Callout tone="warning" role="alert">{copy('errors.'+message,{defaultValue:copy('errors.failed')})}</Callout>}
            {pendingOperation&&<Callout tone="warning" role="status"><p>{copy('pending')}</p><Button size="sm" variant="secondary" disabled={working||busy} onClick={()=>void recover()}>{t('novelEditor.snapshots.recover')}</Button></Callout>}
            {review&&<section className="space-y-3" aria-label={copy('changes')}>
                <h3 className="font-display text-h3">{copy('changes')}</h3>
                <p>{copy('counts',{...review.counts})}</p>
                <p className="text-caption text-parchment-300">{copy('savedOnly')}</p>
                {review.blockers.map((block)=><Callout key={block.code} tone="warning" role="alert">{copy('errors.'+block.code,{defaultValue:copy('errors.failed')})} {copy('affected',{count:block.ids.length})}</Callout>)}
                {!review.changes.length&&<p>{copy('unchanged')}</p>}
                <ul className="space-y-2">{review.changes.slice(0,visible).map((item)=><li key={item.kind+':'+item.id}><Button variant="secondary" size="sm" disabled={working} className="h-auto max-w-full whitespace-normal text-left" onClick={()=>void inspect(item)}>{t('novelEditor.snapshots.kinds.'+item.kind)} · {item.title} · {item.fields.map(fieldName).join(', ')}</Button></li>)}</ul>
                {review.changes.length>visible&&<Button variant="secondary" size="sm" onClick={()=>setVisible((value)=>value+50)}>{t('novelEditor.snapshots.showMore')}</Button>}
                {selected&&<section className="space-y-3" aria-label={copy('detail')}><h4 className="font-display text-h3">{selected.title}</h4>
                    {fields.map((field)=><div key={field.key} className="rounded-md border border-line p-3"><p className="mb-2 font-ui text-body">{fieldName(field.key)}</p><div className="grid gap-3 md:grid-cols-2"><div><p className="text-caption text-parchment-300">{copy('before')}</p>{field.key==='details.coverAssetId'?<NovelCoverPreview assetId={field.before} title={selected.title}/>:<p className="whitespace-pre-wrap break-words text-body">{readable(field.key,field.before,false)}</p>}</div><div><p className="text-caption text-parchment-300">{copy('after')}</p>{field.key==='details.coverAssetId'?<NovelCoverPreview assetId={field.after} title={selected.title}/>:<p className="whitespace-pre-wrap break-words text-body">{readable(field.key,field.after,true)}</p>}</div></div></div>)}
                    {reading&&<div className="grid gap-4 md:grid-cols-2"><section className="min-w-0"><h4 className="mb-2 text-body">{copy('before')}</h4><Markdown content={reading.current.body}/></section><section className="min-w-0"><h4 className="mb-2 text-body">{copy('after')}</h4><Markdown content={reading.saved.body}/></section></div>}
                </section>}
                <h4 className="font-ui text-body">{copy('laterCount',{count:review.laterUnits.length})}</h4>
                <p className="text-caption text-parchment-200">{copy(choices.laterUnits==='keep'?'keepHelp':'trashHelp')}</p>
                <ul className="space-y-1">{review.laterUnits.slice(0,visible).map((item)=><li key={item.id}>{t('novelEditor.snapshots.kinds.'+item.kind)} · {item.title}</li>)}</ul>
                {review.laterUnits.length>visible&&<Button variant="secondary" size="sm" onClick={()=>setVisible((value)=>value+50)}>{copy('moreLater')}</Button>}
            </section>}
        </div>
    </Modal>
}
