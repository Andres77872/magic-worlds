import { NovelAssistantSources } from './NovelAssistantSources'
import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import { isAssistantContextRequest } from '@/infrastructure/api/storyAssistantContextContract'
import { studioReviewVersion } from '@/shared/storyStudioState'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import type { StoryAnnotationSelection } from '@/shared/types/storyAnnotation.types'
import type { StoryAssistantContext,StoryAssistantContextOptions } from '@/shared/types/storyAssistant.types'
import { canonicalJson } from '@/utils/json'
import { Button,Callout,Chip,Drawer,Field,Input,Select,SwitchRow,Textarea } from '@/ui/primitives'
import type { AssistantContextSource } from '../hooks/useAssistantContextSource'

interface Props {open:boolean;onClose:()=>void;source:AssistantContextSource;story:StoryOutline;anchorSceneId:string|null;selection:StoryAnnotationSelection|null}
type Failure='sourceChanged'|'excluded'|'budget'|'failed'
export function NovelAssistantContextDrawer({open,onClose,source,story,anchorSceneId,selection}:Props){
    const {t}=useTranslation(),text=(key:string,options?:Record<string,unknown>)=>t('novelEditor.assistantContext.'+key,options)
    const [message,setMessage]=useState(''),[task,setTask]=useState<'ask'|'suggest'>('ask')
    const [scopeChoice,setScopeChoice]=useState<{selection:StoryAnnotationSelection|null;anchorSceneId:string|null;value:StoryAssistantContextOptions['scope']}>(()=>({selection,anchorSceneId,value:selection?'selection':'scene'}))
    const scope=scopeChoice.selection===selection&&scopeChoice.anchorSceneId===anchorSceneId?scopeChoice.value:selection?'selection':'scene'
    const [sceneIds,setSceneIds]=useState<string[]>([]),[policy,setPolicy]=useState<StoryAssistantContextOptions['revealPolicy']>('through_anchor')
    const [includeArchived,setIncludeArchived]=useState(false),[includeCodex,setIncludeCodex]=useState(true)
    const [limits,setLimits]=useState({contextWindow:'16000',outputTokens:'2000',maxSources:'6',maxPassages:'24'})
    const [snapshot,setSnapshot]=useState<{value:StoryAssistantContext;formKey:string;knownVersion:string;source:AssistantContextSource;invalidated:boolean}|null>(null)
    const [failure,setFailure]=useState<Failure|null>(null),[running,setRunning]=useState<{source:AssistantContextSource;controller:AbortController}|null>(null)
    const serial=useRef(0),inflight=useRef<AbortController|null>(null)
    useEffect(()=>()=>{serial.current++;inflight.current?.abort()},[open,source])
    const options:StoryAssistantContextOptions={anchorSceneId:anchorSceneId??'',scope,sceneIds:scope==='scenes'?[...new Set([...(anchorSceneId?[anchorSceneId]:[]),...sceneIds])]:[],
        selection:scope==='selection'?selection:null,task,message:message.trim(),revealPolicy:policy,includeArchived,includeCodex,
        limits:{contextWindow:Number(limits.contextWindow),outputTokens:Number(limits.outputTokens),maxSources:Number(limits.maxSources),maxPassages:Number(limits.maxPassages)}}
    const valid=isAssistantContextRequest({...options,sourceVersion:'0'.repeat(64)}),formKey=canonicalJson(options),knownVersion=studioReviewVersion(story)
    const busy=Boolean(open&&running?.source===source&&!running.controller.signal.aborted)
    const visible=snapshot?.source===source?snapshot:null
    const current=Boolean(visible&&!visible.invalidated&&visible.formKey===formKey&&visible.knownVersion===knownVersion&&source.isCurrent())
    const scenes=story.chapters.flatMap(chapter=>chapter.scenes.map(scene=>({id:scene.id,label:chapter.title+' · '+scene.title})))
    const label=(id:string)=>scenes.find(scene=>scene.id===id)?.label??id
    function close(){serial.current++;inflight.current?.abort();setRunning(null);onClose()}
    async function prepare(){
        if(busy||!valid||!source.isCurrent())return
        const attempt=++serial.current,controller=new AbortController();inflight.current?.abort();inflight.current=controller
        setRunning({source,controller});setFailure(null);setSnapshot(old=>old?{...old,invalidated:true}:old)
        try{
            const value=await source.prepare(structuredClone(options),controller.signal)
            if(attempt!==serial.current||controller.signal.aborted||!source.isCurrent())return
            setSnapshot({value,formKey,knownVersion,source,invalidated:false})
        }catch(error){
            if(attempt!==serial.current||controller.signal.aborted||!source.isCurrent())return
            const code=error instanceof ApiError?error.code:null
            setFailure(code==='STORY_ASSISTANT_SOURCE_CHANGED'||code==='STORY_ASSISTANT_SELECTION_CHANGED'?'sourceChanged':code==='STORY_ASSISTANT_SOURCE_EXCLUDED'?'excluded':code==='STORY_CONTEXT_BUDGET_EXCEEDED'?'budget':'failed')
        }finally{if(attempt===serial.current&&source.isCurrent())setRunning(null)}
    }
    const value=visible?.value
    return <Drawer open={open} onClose={close} title={text('title')} size="xl" footer={<>
        <Button variant="ghost" onClick={close}>{text('close')}</Button>
        <Button variant="primary" disabled={!valid||busy||!source.isCurrent()} aria-busy={busy} onClick={()=>void prepare()}>{text(busy?'preparing':'prepare')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <Callout tone="info">{text('savedOnly')}</Callout>
            <p className="text-label text-parchment-300">{text('anchor')}: {anchorSceneId?label(anchorSceneId):'—'}</p>
            <Field label={text('question')} helper={text('questionHelp')}><Textarea value={message} maxLength={4000} rows={3} onChange={event=>setMessage(event.target.value)}/></Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={text('task')}><Select value={task} onChange={value=>setTask(value as typeof task)} options={(['ask','suggest'] as const).map(value=>({value,label:text(value)}))}/></Field>
                <Field label={text('scope')}><Select value={scope} onChange={value=>setScopeChoice({selection,anchorSceneId,value:value as typeof scope})} options={(['selection','scene','chapter','novel','scenes'] as const).map(value=>({value,label:text(value),disabled:value==='selection'&&!selection}))}/></Field>
            </div>
            {scope==='selection'&&selection&&<section aria-label={text('selectionQuote')}><blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{selection.quote}</blockquote></section>}
            {scope==='scenes'&&<section aria-label={text('selectedScenes')} className="space-y-2"><p className="text-label">{text('selectedScenes')}</p><div className="flex flex-wrap gap-2">{scenes.map(scene=><Chip key={scene.id} active={scene.id===anchorSceneId||sceneIds.includes(scene.id)} disabled={scene.id===anchorSceneId||options.sceneIds.length>=20&&!sceneIds.includes(scene.id)} onClick={()=>setSceneIds(old=>old.includes(scene.id)?old.filter(id=>id!==scene.id):[...old,scene.id])}>{scene.label}</Chip>)}</div></section>}
            <Field label={text('policy')} helper={text('policyHelp')}><Select value={policy} onChange={value=>setPolicy(value as typeof policy)} options={(['through_anchor','author_analysis'] as const).map(value=>({value,label:text(value)}))}/></Field>
            <SwitchRow label={text('includeArchived')} description={text('includeArchivedHelp')} checked={includeArchived} onChange={setIncludeArchived}/>
            <SwitchRow label={text('includeCodex')} description={text('includeCodexHelp')} checked={includeCodex} onChange={setIncludeCodex}/>
            <fieldset className="space-y-3"><legend className="text-label text-parchment-200">{text('limits')}</legend><div className="grid grid-cols-2 gap-3">
                {(['contextWindow','outputTokens','maxSources','maxPassages'] as const).map(key=><Field key={key} label={text(key)}><Input type="number" min={key==='contextWindow'?1024:1} max={{contextWindow:262144,outputTokens:65536,maxSources:20,maxPassages:80}[key]} step={1} value={limits[key]} onChange={event=>setLimits(old=>({...old,[key]:event.target.value}))}/></Field>)}
            </div><p className="text-caption text-parchment-300">{text('limitsHelp')}</p></fieldset>
            {!valid&&message.trim()&&<Callout tone="warning">{text('invalid')}</Callout>}
            {busy&&<p role="status">{text('preparing')}</p>}
            {failure&&<Callout tone="warning" role="alert">{text(failure)}</Callout>}
            {value?<NovelAssistantSources value={value} story={story} current={current}/>:!busy&&<p className="text-body text-parchment-300">{text('empty')}</p>}
        </div>
    </Drawer>
}
