import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bookmark,StickyNote } from 'lucide-react'
import { ApiError } from '@/infrastructure/api'
import type { StoryAnnotation,StoryAnnotationOperation,StoryAnnotationPage,StoryAnnotationQuery,StoryAnnotationSelection } from '@/shared'
import { documentText } from '@/shared/storyDocument'
import { annotationContext,resolveAnnotationRange } from '@/shared/storyAnnotationAnchors'
import { Badge,Button,Callout,Chip,Drawer,Field,Icon,Input,Modal,Select,Textarea } from '@/ui/primitives'
import { downloadBlob,safeFilename } from '@/utils/download'
import { makeRequestId } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'
import type { AnnotationIntent } from '../persistence/annotationJournal'
import type { PersonalNoteDraft } from '../hooks/useAnnotationDrafts'
import type { AnnotationSource } from '../hooks/useAnnotationSource'
import type { PersonalAnnotations } from '../hooks/usePersonalAnnotations'

interface Props {
    kind?:'note'|'bookmark';onKindChange?:(kind:'note'|'bookmark')=>void;initialDraft?:PersonalNoteDraft|null
    open:boolean;onClose:()=>void;annotations:PersonalAnnotations;readOnly:boolean;activeSceneId:string|null
    captureSelection:()=>Promise<StoryAnnotationSelection|null>;beforeWrite:()=>Promise<boolean>
    onOpenScene?:(sceneId:string)=>Promise<boolean>
    onOpenAnchor?:(annotation:StoryAnnotation)=>Promise<boolean>
}
interface AttachmentReview {selection:StoryAnnotationSelection;note:StoryAnnotation|null;draft:PersonalNoteDraft|null;context?:ReturnType<typeof annotationContext>;sceneTitle?:string}
const conflictCode=(error:unknown)=>error instanceof ApiError&&['STORY_ANNOTATION_CONFLICT','STORY_ANNOTATION_ANCHOR_CONFLICT','STORY_ANNOTATION_SOURCE_CHANGED'].includes(error.code??'')
const sameDraft=(a:PersonalNoteDraft,b:PersonalNoteDraft)=>a.storageKey===b.storageKey&&canonicalJson(a.write)===canonicalJson(b.write)

export function NovelAnnotationDrawer(props:Props){
    return props.annotations.source?<AnnotationDrawer key={props.annotations.source.key+':'+(props.kind??'note')+':'+(props.initialDraft?.write.annotationId??'normal')} {...props} source={props.annotations.source}/>:null
}
function AnnotationDrawer({open,onClose,annotations,source,readOnly,activeSceneId,captureSelection,beforeWrite,onOpenScene,onOpenAnchor,kind='note',onKindChange,initialDraft}:Props&{source:AnnotationSource}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.'+(kind==='bookmark'?'bookmarks':'annotations')+'.'+key,values)
    const {drafts,mutations,confirmation}=annotations
    const ownDrafts=drafts.items.filter((record)=>(record.write.kind??'note')===kind),limit=kind==='bookmark'?255:8000
    const [filters,setFilters]=useState<Omit<StoryAnnotationQuery,'sceneId'|'before'>>({state:'open'}),[sceneOnly,setSceneOnly]=useState(false)
    const query=useMemo<StoryAnnotationQuery>(()=>({...filters,...(kind==='bookmark'?{kind}:{}),...(sceneOnly&&activeSceneId?{sceneId:activeSceneId}:{})}),[filters,kind,sceneOnly,activeSceneId])
    const [search,setSearch]=useState(''),[refresh,setRefresh]=useState(0)
    const [page,setPage]=useState<StoryAnnotationPage|null>(null),[loading,setLoading]=useState(false),[working,setWorking]=useState(false)
    const [note,setNote]=useState<StoryAnnotation|null>(null),[form,setForm]=useState<PersonalNoteDraft|null>(()=>initialDraft&&(initialDraft.write.kind??'note')===kind?initialDraft:null)
    const [conflict,setConflict]=useState<StoryAnnotation|null>(null),[review,setReview]=useState<AttachmentReview|null>(null)
    const [passage,setPassage]=useState<ReturnType<typeof annotationContext>|null>(null),[error,setError]=useState<string|null>(null)
    const [saved,setSaved]=useState(false),[copied,setCopied]=useState(false)
    const alive=useRef(false),flight=useRef(false),listEpoch=useRef(0),detailEpoch=useRef(0),clipboardEpoch=useRef(0)
    const displayed=useRef({note,form})
    useLayoutEffect(()=>{displayed.current={note,form}},[note,form])
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    const current=useCallback(()=>alive.current&&source.isCurrent(),[source])
    const accept=useCallback((intent:AnnotationIntent,fresh:StoryAnnotation)=>{
        if(!current()||(fresh.kind??'note')!==kind||displayed.current.note?.id!==fresh.id&&displayed.current.form?.write.annotationId!==fresh.id)return
        setNote(fresh);setPassage(null);setReview(null);setSaved(true);setError(null);setCopied(false);clipboardEpoch.current++
        const device=displayed.current.form
        if(intent.draft&&device?.write.annotationId===fresh.id){
            if(sameDraft(device,intent.draft))setForm(null)
            else setConflict(fresh)
        }
    },[current,kind])
    useEffect(()=>{
        if(confirmation?.scopeKey===source.key){
            accept(confirmation.intent,confirmation.note)
        }
    },[confirmation,source.key,accept])
    useEffect(()=>{
        if(!open)return
        const epoch=++listEpoch.current;let subscribed=true
        const active=()=>subscribed&&current()&&epoch===listEpoch.current
        // eslint-disable-next-line react-hooks/set-state-in-effect -- replace a scoped metadata-page subscription, retaining the separate device form
        setLoading(true);setError(null);setPage(null)
        void source.page(query).then((value)=>{if(active())setPage(value)}).catch(()=>{if(active())setError('failed')}).finally(()=>{if(active())setLoading(false)})
        return()=>{subscribed=false}
    },[open,query,refresh,source,current,confirmation?.intent.write.requestId])

    async function run(action:()=>Promise<void>){
        if(!current()||flight.current)return
        flight.current=true;setWorking(true);setError(null);setSaved(false);setCopied(false)
        try{await action()}catch(error){if(current())setError(conflictCode(error)?'changed':'failed')}
        finally{flight.current=false;if(current())setWorking(false)}
    }
    function retain(value:PersonalNoteDraft['write'],previous?:PersonalNoteDraft){
        const record=drafts.save(value,previous)
        if(record){displayed.current={note:displayed.current.note,form:record};setForm(record);clipboardEpoch.current++;setCopied(false)}
        return record
    }
    function show(fresh:StoryAnnotation){
        if((fresh.kind??'note')!==kind){setError('changed');return}
        displayed.current={note:fresh,form:null};setNote(fresh);setForm(null);setConflict(null);setReview(null);setPassage(null);setCopied(false);clipboardEpoch.current++
    }
    async function choose(id:string){
        const epoch=++detailEpoch.current
        await run(async()=>{const fresh=await source.detail(id);if(current()&&epoch===detailEpoch.current)show(fresh)})
    }
    async function resume(record:PersonalNoteDraft){
        if(mutations.hasPending(record.write.annotationId))return
        await run(async()=>{
            const fresh=record.write.mode==='edit'?await source.detail(record.write.annotationId):null
            if(!current())return
            if((record.write.kind??'note')!==kind||fresh&&(fresh.kind??'note')!==kind){setError('changed');return}
            displayed.current={note:fresh,form:record};setNote(fresh);setPassage(null);setReview(null);setCopied(false)
            retain({...record.write,sequence:record.write.sequence+1},record)
            setConflict(fresh&&fresh.revision!==record.write.baseRevision?fresh:null)
        })
    }
    async function add(){
        if(readOnly)return
        await run(async()=>{
            const selection=await captureSelection()
            if(!current())return
            if(!selection){setError('selectHelp');return}
            displayed.current={note:null,form:null};setNote(null);setConflict(null);setPassage(null);setReview(null)
            retain({storyId:source.storyId,...(kind==='bookmark'?{kind}:{}),annotationId:makeRequestId(kind==='bookmark'?'mw-bookmark':'mw-note'),body:'',sequence:0,mode:'create',selection,baseRevision:null,originalBody:null})
        })
    }
    function edit(body:string){
        if(!current()||readOnly||note?.head.readOnly||note?.state==='trashed'||Array.from(body).length>limit)return
        setSaved(false);setCopied(false)
        if(form)retain({...form.write,body,sequence:form.write.sequence+1},form)
        else if(note)retain({storyId:source.storyId,...(kind==='bookmark'?{kind}:{}),annotationId:note.id,mode:'edit',selection:null,body,sequence:0,baseRevision:note.revision,originalBody:note.body})
    }
    async function verifySelection(selection:StoryAnnotationSelection){
        if(!await beforeWrite()||!current()){if(current())setError('blocked');return false}
        const fresh=await source.currentScene(selection.sceneId)
        if(!current())return false
        if(fresh.inheritance?.readOnly||fresh.revision!==selection.expectedRevision||fresh.contentHash!==selection.expectedContentHash){setError('changed');return false}
        return true
    }
    async function submit(operation:StoryAnnotationOperation,binding?:PersonalNoteDraft){
        const write={requestId:makeRequestId('mw-note-write'),operation:{...operation,...(kind==='bookmark'?{kind:'bookmark' as const}:{})}}
        try{
            const fresh=await (kind==='bookmark'?mutations.start(write,binding,'bookmark'):mutations.start(write,binding))
            if(fresh&&current()){accept({storyId:source.storyId,write,...(binding?{draft:binding}:{})},fresh);setRefresh((value)=>value+1)}
        }catch(error){
            if(conflictCode(error)&&current()&&note){
                try{const fresh=await source.detail(note.id);if(current())setConflict(fresh)}catch{/* Keep the original device form and visible error. */}
            }
            throw error
        }
    }
    async function save(){
        if(!form||readOnly||mutations.hasPending(form.write.annotationId))return
        const snapshot=form
        await run(async()=>{
            const value=snapshot.write
            if(value.mode==='create'){
                if(value.selection&&await verifySelection(value.selection))await submit({op:'create',id:value.annotationId,body:value.body,anchor:value.selection,...(value.kind==='bookmark'?{kind:'bookmark'}:{})},snapshot)
            }else if(value.baseRevision)await submit({op:'edit',id:value.annotationId,expectedRevision:value.baseRevision,body:value.body},snapshot)
        })
    }
    async function prepareAttachment(){
        if(readOnly)return
        await run(async()=>{
            const selection=await captureSelection()
            if(kind==='bookmark'&&selection&&current()){
                const scene=await source.currentScene(selection.sceneId),text=documentText(scene.document)
                if(!current())return
                if(scene.revision!==selection.expectedRevision||scene.contentHash!==selection.expectedContentHash||text.slice(selection.startOffset,selection.endOffset)!==selection.quote){setError('changed');return}
                setReview({selection,note,draft:form,sceneTitle:scene.title,context:annotationContext(text,{startOffset:selection.startOffset,endOffset:selection.endOffset,text:selection.quote})});return
            }
            if(current()){if(selection)setReview({selection,note,draft:form});else setError('selectHelp')}
        })
    }
    async function attach(){
        if(!review||readOnly)return
        const snapshot=review
        await run(async()=>{
            if(!await verifySelection(snapshot.selection))return
            if(snapshot.note)await submit({op:'reanchor',id:snapshot.note.id,expectedRevision:snapshot.note.revision,expectedAnchorVersion:snapshot.note.anchorVersion,anchor:snapshot.selection})
            else if(snapshot.draft){
                const latest=displayed.current.form
                if(latest?.write.annotationId!==snapshot.draft.write.annotationId||latest.write.mode!=='create')return
                retain({...latest.write,selection:snapshot.selection,sequence:latest.write.sequence+1},latest);setReview(null)
            }
        })
    }
    async function readPassage(){
        if(!note)return
        const id=note.id
        await run(async()=>{
            const fresh=await source.detail(id)
            if(!current())return
            setNote(fresh)
            if(!fresh.anchor){setError('orphan');setPassage(null);return}
            const scene=await source.currentScene(fresh.sceneId),range=resolveAnnotationRange(scene,fresh.anchor)
            if(!current())return
            if(!range){setError('changed');setPassage(null);return}
            setPassage(annotationContext(documentText(scene.document),range))
        })
    }
    async function more(){
        if(!page?.nextBefore)return
        const snapshot=page,epoch=listEpoch.current
        await run(async()=>{
            const next=await source.page({...query,before:snapshot.nextBefore!})
            if(!current()||epoch!==listEpoch.current)return
            if(next.annotationRevision!==snapshot.annotationRevision){setError('newer');return}
            const ids=new Set(snapshot.items.map((item)=>item.id))
            setPage({...next,items:[...snapshot.items,...next.items.filter((item)=>!ids.has(item.id))]})
        })
    }
    const body=form?.write.body??note?.body??'',count=Array.from(body).length
    const dirty=Boolean(form&&(form.write.mode==='create'||form.write.body!==form.write.originalBody))
    const pending=mutations.hasPending(form?.write.annotationId??note?.id)
    const locked=readOnly||Boolean(note?.head.readOnly)||note?.state==='trashed'
    const savedDraft=note&&!form?ownDrafts.find((item)=>item.write.annotationId===note.id):undefined
    async function copyText(){
        if(!current())return
        const epoch=++clipboardEpoch.current;setCopied(false)
        try{await navigator.clipboard.writeText(body);if(current()&&clipboardEpoch.current===epoch)setCopied(true)}catch{if(current()&&clipboardEpoch.current===epoch)setError('clipboardFailed')}
    }
    function useAccount(){
        if(!current())return
        const record=form??savedDraft;if(record)drafts.remove(record)
        if(conflict)setNote(conflict)
        displayed.current={note:conflict??note,form:null};setForm(null);setConflict(null);setError(null);setCopied(false);clipboardEpoch.current++
    }
    function rebase(){
        if(!form||!conflict||locked||conflict.head.readOnly||conflict.state==='trashed'||!current())return
        retain({...form.write,baseRevision:conflict.revision,originalBody:conflict.body,sequence:form.write.sequence+1},form)
        setNote(conflict);setConflict(null);setError(null)
    }
    const selectedId=form?.write.annotationId??note?.id
    return <>
        <Drawer open={open} onClose={onClose} title={copy('title')} icon={<Icon icon={kind==='bookmark'?Bookmark:StickyNote}/>} size="xl">
            <div className="space-y-4">
                {onKindChange&&<div className="flex flex-wrap gap-2" aria-label={t('novelEditor.bookmarks.kindLabel')}><Chip active={kind==='note'} onClick={()=>onKindChange('note')}>{t('novelEditor.annotations.title')}</Chip><Chip active={kind==='bookmark'} onClick={()=>onKindChange('bookmark')}>{t('novelEditor.bookmarks.title')}</Chip></div>}
                <p className="text-body text-parchment-200">{copy('help')}</p>
                <Button size="sm" disabled={readOnly||working} onClick={()=>void add()}>{copy('add')}</Button>
                {error&&<Callout tone="warning" role="alert">{copy(error)}</Callout>}
                {saved&&<Callout role="status">{copy('saved')}</Callout>}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={copy('state')}><Select value={query.state??''} onChange={(value)=>setFilters({...filters,state:(value||undefined) as StoryAnnotationQuery['state']})} options={[{value:'',label:copy('allStates')},...(kind==='bookmark'?['open','trashed'] as const:['open','resolved','trashed'] as const).map((value)=>({value,label:copy('states.'+value)}))]}/></Field>
                    <Field label={copy('anchorState')}><Select value={query.anchorState??''} onChange={(value)=>setFilters({...filters,anchorState:(value||undefined) as StoryAnnotationQuery['anchorState']})} options={[{value:'',label:copy('allAnchors')},...(['attached','orphaned'] as const).map((value)=>({value,label:copy('anchors.'+value)}))]}/></Field>
                    <Field label={copy('scope')}><Select value={query.sceneId?'scene':'all'} onChange={(value)=>setSceneOnly(value==='scene')} options={[{value:'all',label:copy('allScenes')},{value:'scene',label:copy('currentScene'),disabled:!activeSceneId}]}/></Field>
                    <Field label={copy('search')}><Input value={search} maxLength={128} onChange={(event)=>setSearch(event.target.value)}/></Field>
                </div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>setFilters({...filters,q:search.trim()||undefined})}>{copy('searchAction')}</Button><Button size="sm" variant="ghost" onClick={()=>setRefresh((value)=>value+1)}>{copy('refresh')}</Button></div>
                {loading&&<p role="status">{copy('working')}</p>}
                {page?.items.length===0&&<p className="text-body text-parchment-300">{copy('empty')}</p>}
                <ul className="space-y-2" aria-label={copy('title')}>
                    {page?.items.map((item)=><li key={item.id}><Button variant="secondary" full className="h-auto justify-start whitespace-normal text-left" disabled={working} aria-pressed={item.id===selectedId} onClick={()=>void choose(item.id)}>
                        <span className="min-w-0 space-y-1"><span className="block text-caption text-parchment-300">{item.sceneTitle} · {copy('states.'+item.state)} · {copy('anchors.'+item.anchorState)}</span><span className="block">{item.bodyPreview}</span><span className="block text-caption text-parchment-300">{item.quotePreview}</span></span>
                    </Button></li>)}
                </ul>
                {page?.nextBefore&&<Button size="sm" variant="secondary" disabled={working} onClick={()=>void more()}>{copy('more')}</Button>}
                {ownDrafts.length>0&&<section className="space-y-2" aria-label={copy('localTitle')}><h3 className="font-display text-h3">{copy('localTitle')}</h3>
                    {ownDrafts.map((record)=><div key={record.storageKey??record.write.annotationId} className="rounded-md border border-line p-3">
                        <p className="whitespace-pre-wrap text-body">{record.write.body||record.write.selection?.quote}</p>
                        {record.storageFailed&&<Callout tone="warning" role="alert">{copy('storageFailed')}</Callout>}
                        <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={working||mutations.hasPending(record.write.annotationId)} onClick={()=>void resume(record)}>{copy('resume')}</Button>
                            <Button size="sm" variant="ghost" disabled={!source.isCurrent()} onClick={()=>{if(current())downloadBlob(new Blob([record.write.body],{type:'text/plain;charset=utf-8'}),safeFilename('personal-note-'+record.write.annotationId)+'.txt')}}>{copy('download')}</Button></div>
                    </div>)}
                </section>}
                {(note||form)&&<section className="space-y-3 rounded-lg border border-line bg-ink-800 p-4" aria-label={copy(form?.write.mode==='create'?'newNote':'editNote')}>
                    {note&&<div className="flex flex-wrap gap-2"><Badge>{copy('states.'+note.state)}</Badge><Badge>{copy('anchors.'+note.anchorState)}</Badge>{note.source.kind==='copy'&&<Badge>{copy('copiedNote')}</Badge>}</div>}
                    {locked&&<Callout role="status">{copy('readOnly')}</Callout>}
                    {note?.anchorState==='orphaned'&&<Callout tone="warning" role="status">{copy('orphan')} {copy('reasons.'+note.orphanReason)}</Callout>}
                    <p className="text-caption text-parchment-300">{copy(form?.write.mode==='create'?'selectedPassage':'lastPassage')}</p>
                    <blockquote className="whitespace-pre-wrap font-narrative text-body">{(form?.write.selection?.quote??note?.lastAnchor.quote)||copy('cursorPoint')}</blockquote>
                    {note&&canonicalJson(note.origin)!==canonicalJson(note.lastAnchor)&&<details><summary>{copy('originalPassage')}</summary><blockquote className="whitespace-pre-wrap font-narrative">{note.origin.quote||copy('cursorPoint')}</blockquote></details>}
                    {savedDraft&&<Callout role="status"><p>{copy('recovery')}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={working||pending} onClick={()=>void resume(savedDraft)}>{copy('resume')}</Button><Button size="sm" variant="secondary" disabled={pending} onClick={useAccount}>{copy('useAccount')}</Button></div></Callout>}
                    <Field label={copy('noteBody')} helper={copy('characters',{count})}><Textarea value={body} readOnly={locked||Boolean(savedDraft)} onChange={(event)=>edit(event.target.value)} rows={6}/></Field>
                    {form&&<p role="status" className="text-caption text-parchment-300">{copy(form.storageFailed?'storageFailed':'draftSaved')}</p>}
                    {conflict&&form&&<section aria-label={copy('conflictTitle')} className="space-y-3"><h4>{copy('conflictTitle')}</h4><p>{copy('rebaseHelp')}</p>
                        <Field label={copy('device')}><Textarea value={form.write.body} readOnly rows={4}/></Field><Field label={copy('account')}><Textarea value={conflict.body} readOnly rows={4}/></Field>
                        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={locked||conflict.head.readOnly||conflict.state==='trashed'||pending} onClick={rebase}>{copy('rebase')}</Button><Button size="sm" variant="secondary" disabled={pending} onClick={useAccount}>{copy('useAccount')}</Button></div>
                    </section>}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={locked||working||pending||!dirty||!body.trim()||Boolean(conflict)} onClick={()=>void save()}>{copy('save')}</Button>
                        <Button size="sm" variant="secondary" aria-busy={working} disabled={locked||pending||Boolean(note&&dirty)} onClick={()=>void prepareAttachment()}>{copy('reanchor')}</Button>
                        {note&&<>
                            <Button size="sm" variant="secondary" disabled={working} onClick={()=>void readPassage()}>{copy('readPassage')}</Button>
                            {(kind==='bookmark'?onOpenAnchor:onOpenScene)&&<Button size="sm" variant="ghost" disabled={working||kind==='bookmark'&&(!note.anchor||note.head.readOnly)} onClick={()=>void run(async()=>{const ok=kind==='bookmark'?await onOpenAnchor?.(note):await onOpenScene?.(note.sceneId);if(ok&&current())onClose();else if(current())setError('changed')})}>{copy('openScene')}</Button>}
                            {(kind==='note'||note.state==='trashed')&&<Button size="sm" variant="secondary" disabled={readOnly||note.head.readOnly||working||pending||dirty} onClick={()=>void run(()=>submit({op:'set_state',id:note.id,expectedRevision:note.revision,state:note.state==='open'?'resolved':'open'}))}>{copy(note.state==='trashed'?'restore':note.state==='open'?'resolve':'reopen')}</Button>}
                            {note.state!=='trashed'&&<Button size="sm" variant="ghost" disabled={locked||working||pending||dirty} onClick={()=>void run(()=>submit({op:'set_state',id:note.id,expectedRevision:note.revision,state:'trashed'}))}>{copy('trash')}</Button>}
                        </>}
                        <Button size="sm" variant="ghost" onClick={()=>void copyText()}>{copy('copy')}</Button>
                        <Button size="sm" variant="ghost" onClick={()=>{if(current())downloadBlob(new Blob([body],{type:'text/plain;charset=utf-8'}),safeFilename('personal-note-'+selectedId)+'.txt')}}>{copy('download')}</Button>
                        <Button size="sm" variant="ghost" onClick={()=>{displayed.current={note:null,form:null};setNote(null);setForm(null);setConflict(null);setPassage(null);setReview(null);clipboardEpoch.current++}}>{copy('cancelEdit')}</Button>
                    </div>
                    {copied&&<p role="status">{copy('copied')}</p>}
                    {passage&&<section aria-label={copy('reading')} className="space-y-2"><p className="text-caption text-parchment-300">{copy('savedOnly')}</p><p className="whitespace-pre-wrap font-narrative text-body">{passage.beforeCut?'…':''}{passage.before}<mark className="bg-ember-500/15 text-parchment-50" aria-label={!passage.quote?copy('cursorPoint'):undefined}>{passage.quote||'│'}</mark>{passage.after}{passage.afterCut?'…':''}</p></section>}
                </section>}
            </div>
        </Drawer>
        <Modal open={open&&Boolean(review)} onClose={()=>setReview(null)} title={copy('reanchorTitle')} size="lg" footer={<><Button variant="secondary" onClick={()=>setReview(null)}>{t('common.cancel')}</Button><Button disabled={readOnly||working||pending} onClick={()=>void attach()}>{copy('applyAnchor')}</Button></>}>
            <p className="mb-4 text-body text-parchment-200">{copy('reanchorHelp')}</p>
            {error&&<Callout tone="warning" role="alert">{copy(error)}</Callout>}
            <div className="grid gap-4 sm:grid-cols-2"><section><h3>{copy('beforeAnchor')}</h3>{review?.note&&<p className="text-caption text-parchment-300">{review.note.head.title}</p>}<p className="whitespace-pre-wrap font-narrative">{(review?.note?.lastAnchor.quote??review?.draft?.write.selection?.quote)||copy('cursorPoint')}</p></section><section><h3>{copy('afterAnchor')}</h3>{review?.sceneTitle&&<p className="text-caption text-parchment-300">{review.sceneTitle}</p>}<p className="whitespace-pre-wrap font-narrative">{review?.context?<>{review.context.beforeCut?'…':''}{review.context.before}<mark className="bg-ember-500/15 text-parchment-50">{review.context.quote||'│'}</mark>{review.context.after}{review.context.afterCut?'…':''}</>:review?.selection.quote||copy('cursorPoint')}</p></section></div>
        </Modal>
    </>
}
