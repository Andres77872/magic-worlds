import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline,StoryStructureHistoryAction,StoryStructureHistoryOperation,StoryStructureHistoryPage,StoryStructureHistoryQuery,StoryStructureOperation,StoryStructureRevision,StoryStructureOutlineUnit } from '@/shared'
import { Badge,Button,Callout,Field,Input,Modal,Select } from '@/ui/primitives'
import { structureHistoryChanges,structureHistoryOutline,type StructureHistoryChange } from '../utils/structureHistory'
import { restoreFieldChanges,restoreFieldLabel,restoreReadableValue } from '../utils/manuscriptRestoreReview'
import { NovelCoverPreview } from './NovelCoverField'
import { canonicalJson } from '@/utils/json'

export interface StoryHistorySource {
    key:string
    isCurrent:()=>boolean
    readPage:(query:StoryStructureHistoryQuery)=>Promise<StoryStructureHistoryPage>
    readRevision:(revision:number)=>Promise<StoryStructureRevision>
    refreshStory?:()=>Promise<void>
}
interface Props {
    source:StoryHistorySource
    structureRevision:number
    readOnly:boolean
    busy:boolean
    pendingOperation?:StoryStructureOperation|null
    operationError?:string|null
    clearOperationError?:()=>void
    beforeWrite:()=>Promise<boolean>
    operate:(operation:StoryStructureOperation)=>Promise<StoryOutline|null>
}
interface Review {operation:StoryStructureHistoryOperation;detail:StoryStructureRevision}
const actions=['create','move','reorder','duplicate','split_scene','merge_scenes','split_chapter','merge_chapters','archive','trash','restore','bulk_scenes','changeset','add_outline','undo_structure','redo_structure','initial','copy_novel','create_snapshot','restore_snapshot']
export function NovelStructureHistory({source,structureRevision,readOnly,busy,pendingOperation,operationError,clearOperationError,beforeWrite,operate}:Props) {
    const {t}=useTranslation()
    const copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.structureHistory.'+key,values)
    const label=(action:string)=>action==='restore_structure'?copy('actions.undo_structure'):actions.includes(action)?copy('actions.'+action):copy('actions.other')
    const [query,setQuery]=useState<StoryStructureHistoryQuery>({})
    const [refresh,setRefresh]=useState(0)
    const [page,setPage]=useState<StoryStructureHistoryPage|null>(null)
    const [detail,setDetail]=useState<StoryStructureRevision|null>(null)
    const [review,setReview]=useState<Review|null>(null)
    const [loading,setLoading]=useState(true)
    const [working,setWorking]=useState(false)
    const [error,setError]=useState<string|null>(null)
    const [visibleChanges,setVisibleChanges]=useState(50)
    const epoch=useRef(0),flight=useRef(false)
    const dateError=Boolean(query.fromDate&&query.throughDate&&query.fromDate>query.throughDate)
    useEffect(()=>{
        const current=++epoch.current
        let mounted=true
        const active=()=>mounted&&current===epoch.current&&source.isCurrent()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- replace a scoped remote history subscription, retaining no prior account's rows
        setLoading(true);setPage(null);setDetail(null);setReview(null);setError(null);setWorking(false);flight.current=false
        if(dateError){setLoading(false);return()=>{mounted=false}}
        void (async()=>{
            try {
                if(!source.isCurrent())throw new Error('Scope changed')
                const value=await source.readPage(query)
                if(active())setPage(value)
            } catch {if(active())setError('failed')}
            finally {if(active())setLoading(false)}
        })()
        return()=>{mounted=false;epoch.current=current+1}
    },[source,structureRevision,query,refresh,dateError])
    const stale=Boolean(page&&page.structureRevision!==structureRevision)
    const historyConflict=Boolean(operationError&&['STORY_REVISION_CONFLICT','STORY_METADATA_CONFLICT','STORY_CONTEXT_CHANGED','STORY_CODEX_DUPLICATE','STORY_PENDING_PROPOSAL','STORY_STRUCTURE_UNDO_UNAVAILABLE','STORY_STRUCTURE_CONFLICT'].includes(operationError))
    const locked=readOnly||busy||working||loading||Boolean(pendingOperation)||stale||historyConflict
    const more=async()=>{
        if(!page?.nextBefore||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        try {
            if(!source.isCurrent())return
            const value=await source.readPage({...query,before:page.nextBefore})
            if(current===epoch.current&&source.isCurrent()){
                if(value.structureRevision!==page.structureRevision){setError('stale');return}
                setPage({...value,items:[...page.items,...value.items]})
            }
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const select=async(revision:number)=>{
        if(flight.current)return null
        const current=epoch.current
        flight.current=true;setWorking(true);setError(null)
        try {
            if(!source.isCurrent())return null
            const value=await source.readRevision(revision)
            if(current!==epoch.current||!source.isCurrent())return null
            setDetail(value);setVisibleChanges(50)
            return value
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed');return null}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const reviewAction=async(direction:'undo'|'redo',head:StoryStructureHistoryAction|null)=>{
        if(!head||locked||!page||flight.current)return
        const current=epoch.current
        flight.current=true;setWorking(true);setError(null)
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const value=await source.readRevision(head.revision)
            if(current!==epoch.current||!source.isCurrent())return
            if(!value.before||!value.reversible){setError('unavailable');return}
            setReview({operation:{op:direction+'_structure' as StoryStructureHistoryOperation['op'],revision:head.revision,sourceStructureRevision:page.structureRevision},detail:value})
            setVisibleChanges(50)
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const apply=async()=>{
        if(!review||locked||flight.current)return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null)
        try {
            if(!await beforeWrite()||!source.isCurrent()||current!==epoch.current){if(current===epoch.current)setError('blocked');return}
            const result=await operate(review.operation)
            if(current!==epoch.current||!source.isCurrent())return
            if(result){setReview(null);setRefresh((value)=>value+1)}else setError('failed')
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    const failure=operationError==='STORY_REVISION_CONFLICT'?'textConflict':operationError==='STORY_METADATA_CONFLICT'?'metadataConflict':operationError==='STORY_CONTEXT_CHANGED'||operationError==='STORY_CODEX_DUPLICATE'?'contextConflict':operationError==='STORY_PENDING_PROPOSAL'?'proposalConflict':operationError==='STORY_STRUCTURE_UNDO_UNAVAILABLE'?'unavailable':operationError==='STORY_STRUCTURE_CONFLICT'?'stale':error
    const refreshHistory=async()=>{
        if(flight.current||!source.isCurrent())return
        const current=epoch.current;flight.current=true;setWorking(true);setError(null);clearOperationError?.()
        try {
            await source.refreshStory?.()
            if(current===epoch.current&&source.isCurrent())setRefresh((value)=>value+1)
        }catch {if(current===epoch.current&&source.isCurrent())setError('failed')}
        finally {if(current===epoch.current){flight.current=false;setWorking(false)}}
    }
    function state(unit:StoryStructureOutlineUnit|null,parent:string|null) {
        if(!unit)return copy('absent')
        return [parent??copy('root'),copy('position',{number:unit.order+1}),unit.trashedAt?t('novelEditor.structure.trashTitle'):unit.status?t('novelEditor.structure.statuses.'+unit.status):copy('inherited')].join(' · ')
    }
    function changes(value:StoryStructureRevision,inverse=false) {
        const rows=structureHistoryChanges(value,inverse)
        const a=inverse?value.after:value.before,b=inverse?value.before:value.after
        const root=a?.novel&&b?.novel?restoreFieldChanges(a.novel,b.novel,['title','description','wordGoal','details','status','trashedAt','activeContext']).filter((field)=>canonicalJson(field.before)!==canonicalJson(field.after)):[]
        function fieldRows(fields:ReturnType<typeof restoreFieldChanges>){
            return fields.map((field)=><div key={field.key} className="space-y-1 border-t border-line pt-2"><p className="font-ui text-caption text-parchment-200">{field.key.split('.').map((key)=>t('novelEditor.snapshots.restore.fields.'+key,{defaultValue:restoreFieldLabel(key)})).join(' · ')}</p>
                <dl className="grid gap-2 text-caption sm:grid-cols-2"><div><dt className="text-parchment-300">{copy('before')}</dt><dd className="whitespace-pre-wrap break-words">{field.key==='details.coverAssetId'?<NovelCoverPreview assetId={field.before} title={a?.novel?.title??''}/>:restoreReadableValue(field.before)}</dd></div><div><dt className="text-parchment-300">{copy('after')}</dt><dd className="whitespace-pre-wrap break-words">{field.key==='details.coverAssetId'?<NovelCoverPreview assetId={field.after} title={b?.novel?.title??''}/>:restoreReadableValue(field.after)}</dd></div></dl>
            </div>)
        }
        if(!value.before){
            const outline=structureHistoryOutline(value.after)
            return <><Callout>{copy('legacy')}</Callout><h4>{copy('after')}</h4><ol className="space-y-2">{outline.slice(0,visibleChanges).map(({kind,unit})=><li key={unit.id} className="rounded-md border border-line p-3">
                <p>{t('novelEditor.structure.scopes.'+kind)} · {unit.title??copy('unrecordedTitle')}</p><p className="text-caption text-parchment-300">{state(unit,[...value.after.parts,...value.after.chapters].find((parent)=>parent.id===(unit.chapterId??unit.partId))?.title??null)}</p>
            </li>)}</ol>{outline.length>visibleChanges&&<Button size="sm" variant="secondary" onClick={()=>setVisibleChanges((value)=>value+50)}>{copy('moreChanges')}</Button>}</>
        }
        return <>
            {!rows.length&&!root.length&&!value.referenceChanges?.length&&<p className="text-caption text-parchment-300">{copy('noChanges')}</p>}
            {root.length>0&&<section className="space-y-2 rounded-md border border-line p-3" aria-label={copy('novelDetails')}><h4>{copy('novelDetails')}</h4>{fieldRows(root)}</section>}
            <ol className="space-y-3">{rows.slice(0,visibleChanges).map((row:StructureHistoryChange)=><li key={row.id} className="rounded-md border border-line p-3">
                <p className="font-ui text-body text-parchment-100">{t('novelEditor.structure.scopes.'+row.kind)} · {row.after?.title??row.before?.title??row.id}</p>
                <dl className="mt-2 grid gap-2 text-caption text-parchment-300 sm:grid-cols-2">
                    <div><dt className="font-semibold text-parchment-200">{copy('before')}</dt><dd>{state(row.before,row.beforeParent)}</dd></div>
                    <div><dt className="font-semibold text-parchment-200">{copy('after')}</dt><dd>{state(row.after,row.afterParent)}</dd></div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-2">{row.textChanged&&<Badge>{copy('textChanged')}</Badge>}{row.defaultsChanged&&<Badge>{copy('defaultsChanged')}</Badge>}</div>
                {row.before?.details&&row.after?.details&&<details className="mt-2 space-y-2"><summary className="cursor-pointer font-ui text-caption text-parchment-200">{copy('savedDetails')}</summary>{fieldRows(restoreFieldChanges(row.before,row.after,['title','wordGoal','details','povCardId','locationCardId']).filter((field)=>canonicalJson(field.before)!==canonicalJson(field.after)))}</details>}
            </li>)}</ol>
            {value.referenceChanges?.map((change)=>{
                const before=inverse?change.after:change.before,after=inverse?change.before:change.after
                const old=before?{...before.reference,enabled:before.enabled,removedAt:before.removedAt}:{},next=after?{...after.reference,enabled:after.enabled,removedAt:after.removedAt}:{}
                const fields=[...new Set([...Object.keys(old),...Object.keys(next)])].filter((key)=>!['id','storyId'].includes(key)&&canonicalJson((old as Record<string,unknown>)[key])!==canonicalJson((next as Record<string,unknown>)[key]))
                const ref=after?.reference??before?.reference
                return <section key={change.id} className="space-y-2 rounded-md border border-line p-3" aria-label={copy('referenceDetails')}><h4>{copy('referenceDetails')}{ref?' · '+(ref.snapshot.name??ref.snapshot.alias??ref.cardId):''}</h4>{ref?.snapshot.source_card_version_number!==undefined&&<p className="text-caption text-parchment-300">{t('novelEditor.snapshots.version',{number:ref.snapshot.source_card_version_number})}</p>}{fieldRows(restoreFieldChanges(old,next,fields))}</section>
            })}
            {rows.length>visibleChanges&&<Button variant="secondary" size="sm" onClick={()=>setVisibleChanges((value)=>value+50)}>{copy('moreChanges')}</Button>}
        </>
    }
    return <section className="space-y-4" aria-label={copy('title')}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-h3 text-parchment-100">{copy('title')}</h2>
            <Button size="sm" variant="secondary" disabled={working} onClick={()=>void refreshHistory()}>{copy('refresh')}</Button></div>
        <p className="text-caption text-parchment-300">{copy('help')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
            <Field label={copy('filter')}><Select value={query.action??''} onChange={(action)=>setQuery((value)=>({...value,action:action||undefined}))} options={[{value:'',label:copy('all')},...actions.map((action)=>({value:action,label:label(action)}))]}/></Field>
            <Field label={copy('fromDate')}><Input type="date" value={query.fromDate??''} onChange={(event)=>setQuery((value)=>({...value,fromDate:event.target.value||undefined}))}/></Field>
            <Field label={copy('throughDate')} error={dateError?copy('dateError'):undefined}><Input type="date" value={query.throughDate??''} onChange={(event)=>setQuery((value)=>({...value,throughDate:event.target.value||undefined}))}/></Field>
        </div>
        {(failure||stale)&&<Callout tone="warning" role="alert">{copy(failure??'stale')}</Callout>}
        {pendingOperation&&<Callout tone="warning" role="status">{copy('pending')}</Callout>}
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={locked||!page?.undo} onClick={()=>void reviewAction('undo',page?.undo??null)}>{copy('undo')}</Button>
            <Button size="sm" variant="secondary" disabled={locked||!page?.redo} onClick={()=>void reviewAction('redo',page?.redo??null)}>{copy('redo')}</Button>
        </div>
        {loading&&<p role="status">{t('common.loading')}</p>}
        {!loading&&page?.items.length===0&&<p>{copy('empty')}</p>}
        <ol className="space-y-2">{page?.items.map((row)=><li key={row.revision}>
            <Button size="sm" variant={detail?.revision===row.revision?'primary':'secondary'} className="h-auto max-w-full whitespace-normal text-left" disabled={working} onClick={()=>void select(row.revision)}>
                {copy('revision',{revision:row.revision})} · {label(row.action)}{row.action!==row.targetAction?' · '+label(row.targetAction):''}{row.title?' · '+row.title:''}
            </Button><p className="mt-1 text-caption text-parchment-400">{row.createdAt.replace('T',' ')} · {copy('actors.'+row.actor)}</p>
        </li>)}</ol>
        {page?.nextBefore&&<Button size="sm" variant="secondary" disabled={working} onClick={()=>void more()}>{copy('more')}</Button>}
        {detail&&<section aria-label={copy('comparison')} className="space-y-3 border-t border-line pt-4"><h3 className="font-display text-h3">{copy('revision',{revision:detail.revision})} · {label(detail.action)}</h3>{changes(detail)}</section>}
        <Modal open={Boolean(review)} title={copy('review')} size="lg" onClose={()=>{if(!working)setReview(null)}} footer={<>
            <Button variant="secondary" disabled={working} onClick={()=>setReview(null)}>{t('common.cancel')}</Button>
            <Button disabled={locked||!review} onClick={()=>void apply()}>{copy('apply')}</Button>
        </>}>
            {review&&<div className="space-y-4"><p>{copy('reviewAction',{direction:copy(review.operation.op==='undo_structure'?'undoLabel':'redoLabel'),action:label(review.detail.targetAction)})}</p>
                <p className="text-body text-parchment-200">{copy('reviewHelp')}</p>
                {changes(review.detail,true)}
                {failure&&<Callout tone="warning" role="alert">{copy(failure)}</Callout>}
                {pendingOperation&&<Callout tone="warning" role="status">{copy('pending')}</Callout>}
            </div>}
        </Modal>
    </section>
}
