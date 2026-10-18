import { useLayoutEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check,Clipboard,History } from 'lucide-react'
import type { StoryGenerationStatus } from '@/shared'
import { Badge,Button,Callout,Drawer,Icon,IconButton,Modal,Tag } from '@/ui/primitives'
import type { HistoryGeneration,HistoryGenerationRow } from '../hooks/useGenerationHistory'
import type { NovelRefinementSource,NovelRefinementReference } from '@/shared/types/storyAssistant.types'
import { NovelRefinementSummary } from './NovelRefinementSummary'

const STATUS_TONE:Record<StoryGenerationStatus,'ember'|'arcane'|'glass'>={candidate:'arcane',accepted:'ember',rejected:'glass',stashed:'glass'}
interface Props {
    open:boolean;generations:HistoryGenerationRow[];onClose:()=>void;scopeKey?:string
    loading?:boolean;error?:boolean;hasNext?:boolean;hasPrevious?:boolean
    onNext?:()=>void;onPrevious?:()=>void;onRefresh?:()=>void
    onRead?:(generation:HistoryGenerationRow,signal?:AbortSignal)=>Promise<HistoryGeneration|null>
    onRefine?:(generation:HistoryGeneration,signal:AbortSignal)=>Promise<boolean>
    onReadRefinementSource?:(reference:NovelRefinementReference,signal:AbortSignal)=>Promise<NovelRefinementSource>
    onAuthorVersions?:(generation:HistoryGeneration,startEditing:boolean)=>void
    readOnly?:boolean;refineDisabled?:boolean
}
export function NovelGenerationHistoryDrawer({open,generations,onClose,scopeKey='legacy',loading=false,error=false,hasNext=false,hasPrevious=false,onNext,onPrevious,onRefresh,onRead,onRefine,onReadRefinementSource,onAuthorVersions,readOnly=false,refineDisabled=false}:Props){
    const {t}=useTranslation(),copyText=(key:string)=>t('novelEditor.loading.'+key)
    const [copiedId,setCopiedId]=useState<string|null>(null),[work,setWorking]=useState<{scope:string;id:string}|null>(null),[failure,setFailed]=useState<{scope:string;kind:'read'|'refine'|'source'}|null>(null)
    const working=work?.scope===scopeKey?work.id:null,failed=failure?.scope===scopeKey?failure.kind:null
    const [detail,setDetail]=useState<{scope:string;value:HistoryGeneration}|null>(null)
    const [sourceDetail,setSourceDetail]=useState<{scope:string;generationId:string;value:NovelRefinementSource}|null>(null)
    const live=useRef({open,scopeKey,onRead,onRefine,onReadRefinementSource,readOnly,refineDisabled}),serial=useRef(0),abort=useRef<AbortController|null>(null)
    useLayoutEffect(()=>{live.current={open,scopeKey,onRead,onRefine,onReadRefinementSource,readOnly,refineDisabled}})
    useLayoutEffect(()=>()=>{serial.current++;abort.current?.abort()},[scopeKey,open])
    async function read(row:HistoryGenerationRow,copy=false){
        const owner=live.current,ticket=++serial.current
        abort.current?.abort();const controller=new AbortController();abort.current=controller
        const current=()=>live.current.open&&live.current.scopeKey===owner.scopeKey&&serial.current===ticket&&!controller.signal.aborted
        setWorking({scope:owner.scopeKey,id:row.id});setFailed(null)
        try{
            const generation='output' in row?row:await owner.onRead?.(row,controller.signal)
            if(!current())return
            if(!generation)throw new Error('Saved generation is unavailable')
            if(copy){await navigator.clipboard.writeText(generation.output);if(current())setCopiedId(generation.id)}
            else {setDetail({scope:owner.scopeKey,value:generation});setSourceDetail(null)}
        }catch{if(current())setFailed({scope:owner.scopeKey,kind:'read'})}
        finally{if(current())setWorking(null);if(abort.current===controller)abort.current=null}
    }
    if(!open&&detail)setDetail(null)
    if(!open&&work)setWorking(null)
    if(!open&&failure)setFailed(null)
    const selected=open&&detail?.scope===scopeKey?detail.value:null
    const selectedStatus=selected?(generations.find(row=>row.id===selected.id)?.status??selected.status):null
    const selectedRow=selected?generations.find(row=>row.id===selected.id):null
    const inactive=(selected?.location??selectedRow?.location??'active')!=='active'
    function closeDetail(){serial.current++;abort.current?.abort();setDetail(null);setWorking(null);setFailed(null)}
    async function refine(){
        const owner=live.current
        if(!selected||!owner.onRefine||owner.readOnly||owner.refineDisabled||working||inactive||selected.command==='critique')return
        const ticket=++serial.current,controller=new AbortController()
        abort.current?.abort();abort.current=controller
        const current=()=>live.current.open&&live.current.scopeKey===owner.scopeKey&&serial.current===ticket&&!controller.signal.aborted
        setWorking({scope:owner.scopeKey,id:selected.id});setFailed(null)
        try{
            const ready=await owner.onRefine({...selected,status:selectedStatus!},controller.signal)
            if(current()){if(ready){setDetail(null);onClose()}else setFailed({scope:owner.scopeKey,kind:'refine'})}
        }catch{if(current())setFailed({scope:owner.scopeKey,kind:'refine'})}
        finally{if(current())setWorking(null);if(abort.current===controller)abort.current=null}
    }
    async function readSource(){
        const owner=live.current
        if(!selected?.refinementSource||!owner.onReadRefinementSource||working)return
        const ticket=++serial.current,controller=new AbortController()
        abort.current?.abort();abort.current=controller
        const current=()=>live.current.open&&live.current.scopeKey===owner.scopeKey&&serial.current===ticket&&!controller.signal.aborted
        setWorking({scope:owner.scopeKey,id:selected.id});setFailed(null)
        try{
            const value=await owner.onReadRefinementSource(structuredClone(selected.refinementSource),controller.signal)
            if(current())setSourceDetail({scope:owner.scopeKey,generationId:selected.id,value})
        }catch{if(current())setFailed({scope:owner.scopeKey,kind:'source'})}
        finally{if(current())setWorking(null);if(abort.current===controller)abort.current=null}
    }
    return <>
        <Drawer open={open} onClose={onClose} eyebrow={t('novelEditor.history.eyebrow')} title={t('novelEditor.history.title')} icon={<Icon icon={History} size={18}/>} size="lg" footer={onRefresh||hasNext||hasPrevious?<div className="flex flex-wrap gap-2">
            {onPrevious&&<Button variant="secondary" size="sm" disabled={!hasPrevious||loading} onClick={onPrevious}>{copyText('historyPrevious')}</Button>}
            {onNext&&<Button variant="secondary" size="sm" disabled={!hasNext||loading} onClick={onNext}>{copyText('historyNext')}</Button>}
            {onRefresh&&<Button variant="ghost" size="sm" disabled={loading} onClick={onRefresh}>{copyText('historyRefresh')}</Button>}</div>:undefined}>
            {loading&&<p role="status">{copyText('historyLoading')}</p>}
            {(error||failed==='read')&&<Callout tone="warning" role="alert">{copyText('historyFailed')}</Callout>}
            {!generations.length&&!loading&&!error?<p className="m-0 py-6 text-center font-ui text-sm text-parchment-400">{t('novelEditor.history.empty')}</p>:<ul className="m-0 flex list-none flex-col gap-3 p-0">
                {generations.map((generation)=>{
                    const full='output' in generation,prompt=full?generation.prompt||generation.instruction||generation.promptSummary:generation.instructionPreview
                    const output=full?generation.output:generation.outputPreview
                    return <li key={generation.id} className="rounded-md border border-parchment-50/10 bg-ink-700/60 p-3" data-testid="generation-history-item">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[generation.status]}>{t('novelEditor.history.status.'+generation.status)}</Badge><Tag>{generation.command}</Tag>
                            {!full&&generation.location!=='active'&&<Tag>{copyText(generation.location==='trashed'?'historyTrash':'historyArchived')}</Tag>}
                            <span className="min-w-0 flex-1 truncate font-ui text-xs text-parchment-400">{generation.chapterTitle}{!full?' · '+generation.sceneTitle:''}</span>
                            <IconButton label={t('novelEditor.history.copy')} size="sm" aria-busy={working===generation.id} onClick={()=>void read(generation,true)}><Icon icon={copiedId===generation.id?Check:Clipboard} size={14}/></IconButton></div>
                        {prompt&&<p className="m-0 mb-2 line-clamp-2 border-l-2 border-arcane-500/45 pl-2.5 font-ui text-caption text-arcane-300" data-testid="generation-history-prompt"><span className="text-parchment-400">{t('novelEditor.history.prompt')}: </span>{prompt}{!full&&generation.instructionTruncated?'…':''}</p>}
                        <p className="m-0 line-clamp-4 whitespace-pre-wrap font-narrative text-body leading-relaxed text-parchment-200">{output}{!full&&generation.outputTruncated?'…':''}</p>
                        <Button variant="secondary" size="sm" aria-busy={working===generation.id} onClick={()=>void read(generation)}>{copyText('historyRead')}</Button>
                    </li>
                })}</ul>}
        </Drawer>
        <Modal open={Boolean(selected)} onClose={closeDetail} title={copyText('historyDetail')} size="lg" footer={selected?<div className="w-full space-y-3">
            {failed==='refine'&&<Callout tone="warning" role="alert">{t('novelEditor.assistant.historyRefineFailed')}</Callout>}
            {failed==='source'&&<Callout tone="warning" role="alert">{t('novelEditor.assistant.refineSourceReadFailed')}</Callout>}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" size="sm" disabled={Boolean(working)} onClick={()=>void read(selected,true)}>{t('novelEditor.history.copy')}</Button>
                {onAuthorVersions&&selected.command!=='critique'&&<Button variant="secondary" size="sm" disabled={Boolean(working)} onClick={()=>{onAuthorVersions({...selected,status:selectedStatus!},false);closeDetail();onClose()}}>{t('novelEditor.variants.versions')}</Button>}
                {onAuthorVersions&&!readOnly&&!inactive&&selected.command!=='critique'&&['candidate','stashed'].includes(selectedStatus??'')&&<Button variant="secondary" size="sm" disabled={Boolean(working)||refineDisabled} onClick={()=>{onAuthorVersions({...selected,status:selectedStatus!},true);closeDetail();onClose()}}>{t('novelEditor.variants.open')}</Button>}
                {onRefine&&!readOnly&&!inactive&&selected.command!=='critique'&&<Button size="sm" disabled={Boolean(working)||refineDisabled} onClick={()=>void refine()}>{t('novelEditor.assistant.refineSuggestion')}</Button>}
            </div></div>:undefined}>
            {selected&&<div className="space-y-4"><p className="text-caption text-parchment-300">{selected.chapterTitle}</p>
                {selected.refinementSource&&<section className="space-y-3">
                    <p className="text-label">{t('novelEditor.assistant.'+(selected.refinementSource.variant?'refineVersionLineage':'refineGenerationLineage'))}</p>
                    {onReadRefinementSource&&<Button variant="secondary" size="sm" disabled={Boolean(working)} onClick={()=>void readSource()}>{t('novelEditor.assistant.readRefinementSource')}</Button>}
                    {sourceDetail?.scope===scopeKey&&sourceDetail.generationId===selected.id&&<NovelRefinementSummary value={sourceDetail.value}/>}
                </section>}
                {(selected.prompt||selected.instruction||selected.promptSummary)&&<section><h3 className="font-ui text-label">{t('novelEditor.history.prompt')}</h3><p className="whitespace-pre-wrap text-body text-parchment-200">{selected.prompt||selected.instruction||selected.promptSummary}</p></section>}
                <p className="whitespace-pre-wrap font-narrative text-narrative text-parchment-100">{selected.output}</p></div>}
        </Modal>
    </>
}
