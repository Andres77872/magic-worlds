import { useEffect,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type { StoryOutline } from '@/shared'
import type { StorySearchOptions,StorySearchPage,StorySearchResult,StorySearchMatch } from '@/shared/types/storySearch.types'
import { ApiError } from '@/infrastructure/api'
import { sameSearchMatch } from '@/infrastructure/api/storySearchContract'
import { canonicalJson } from '@/utils/json'
import type { StoryReplacementPreview,StoryReplacementRequest } from '@/shared/types/storyReplacement.types'
import { Badge,Button,Callout,Drawer,Field,Icon,Input,Select,SwitchRow,Textarea } from '@/ui/primitives'
import type { ManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import { replacementError,type ManuscriptReplacements } from '../hooks/useManuscriptReplacements'
import { emptyReplacementForm,type ReplacementForm } from '../persistence/replacementForm'
import { NovelReplacementReview } from './NovelReplacementReview'

interface Props {open:boolean;onClose:()=>void;story:StoryOutline;source:ManuscriptSearchSource|null;beforeNavigate:()=>Promise<boolean>;onNavigate:(result:StorySearchResult)=>boolean|Promise<boolean>;replacements?:ManuscriptReplacements}
const errorKey=(error:unknown)=>error instanceof ApiError&&['STORY_SEARCH_SOURCE_CHANGED','STORY_SEARCH_MATCH_CHANGED'].includes(error.code??'')?'changed':'failed'
export function NovelManuscriptSearch(props:Props){
    return props.open&&props.source?<SearchSession key={props.source.key} {...props} source={props.source}/>:null
}
function SearchSession({onClose,story,source,beforeNavigate,onNavigate,replacements}:Props&{source:ManuscriptSearchSource}){
    const {t}=useTranslation(),copy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.search.'+key,values),replaceCopy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.replacements.'+key,values)
    const [localForm,setLocalForm]=useState<ReplacementForm>({...emptyReplacementForm})
    const {q,scope,status,caseSensitive,includeArchived,replacement}=replacements?.form.form??localForm
    const updateForm=(patch:Partial<ReplacementForm>)=>replacements?replacements.form.update(patch):setLocalForm((old)=>({...old,...patch}))
    const [page,setPage]=useState<StorySearchPage|null>(null),[applied,setApplied]=useState<StorySearchOptions|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
    const [selected,setSelected]=useState<string[]>([]),[review,setReview]=useState<StoryReplacementPreview|null>(null),[replacementNotice,setReplacementNotice]=useState<string|null>(null),[recent,setRecent]=useState('')
    const flight=useRef(false),alive=useRef(true),epoch=useRef(0)
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    const options:StorySearchOptions={q,caseSensitive,includeArchived,...(status?{status:status as StorySearchOptions['status']}:{}),
        ...(scope.startsWith('part:')?{partId:scope.slice(5)}:scope.startsWith('chapter:')?{chapterId:scope.slice(8)}:scope.startsWith('scene:')?{sceneId:scope.slice(6)}:{})}
    const edited=Boolean(applied&&JSON.stringify(options)!==JSON.stringify(applied))
    const valid=q.length>0&&Array.from(q).length<=255&&new TextEncoder().encode(q).length<=1024&&!Array.from(q).some((c)=>c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff)
    const replacementValid=Array.from(replacement).length<=2000&&!Array.from(replacement).some((c)=>c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff)
    const matchKey=(match:StorySearchMatch)=>match.sceneId+':'+match.position
    const replacementRequest:StoryReplacementRequest|null=applied&&page?{...applied,sourceSnapshot:page.sourceSnapshot,replacement,targets:page.items.filter((item)=>selected.includes(matchKey(item))).map(({sceneId,position})=>({sceneId,position}))}:null
    const reviewEdited=review?.operation.op==='replace'&&(edited||canonicalJson(review.operation.preview)!==canonicalJson(replacementRequest))
    const run=async(action:(current:()=>boolean)=>Promise<void>)=>{
        if(flight.current||!source.isCurrent())return
        const captured=++epoch.current;flight.current=true;setBusy(true);setError(null)
        const current=()=>alive.current&&epoch.current===captured&&source.isCurrent()
        try{await action(current)}catch(error){if(current())setError(errorKey(error))}
        finally{if(current()){flight.current=false;setBusy(false)}}
    }
    const search=()=>void run(async(current)=>{
        if(!valid)return
        const query={...options};setPage(null);setApplied(query);setSelected([]);setReview(null);setReplacementNotice(null)
        const value=await source.search(query);if(current())setPage(value)
    })
    const more=()=>void run(async(current)=>{
        if(!page?.nextCursor||!applied||edited)return
        const value=await source.search({...applied,cursor:page.nextCursor})
        if(!current())return
        if(value.sourceSnapshot!==page.sourceSnapshot||value.queryHash!==page.queryHash){setError('changed');return}
        const seen=new Set(page.items.map((item)=>item.sceneId+':'+item.position))
        if(value.items.some((item)=>seen.has(item.sceneId+':'+item.position))||value.nextCursor===page.nextCursor){setError('changed');return}
        setPage({...value,items:[...page.items,...value.items]})
    })
    const choose=(match:StorySearchMatch)=>void run(async(current)=>{
        if(!applied||!page||edited)return
        if(!await beforeNavigate()){if(current())setError('blocked');return}
        if(!current())return
        const result=await source.resolve({...applied,sourceSnapshot:page.sourceSnapshot,target:{sceneId:match.sceneId,position:match.position}})
        if(!current())return
        if(result.queryHash!==page.queryHash||!sameSearchMatch(result.match,match)){setError('changed');return}
        if(!await onNavigate(result)){if(current())setError('blocked');return}
        if(!current())return
        onClose()
    })
    const reviewReplacement=()=>void run(async(current)=>{
        if(!replacements?.source||!replacementRequest||!replacementRequest.targets.length||edited||!replacementValid||replacements.hasPending())return
        setReplacementNotice(null);setReview(null)
        if(!await beforeNavigate()){if(current())setReplacementNotice('blocked');return}
        if(!current())return
        try{const value=await replacements.source.preview(replacementRequest);if(current())setReview(value)}
        catch(error){if(current())setReplacementNotice(replacementError(error))}
    })
    const reviewReverse=(direction:'undo'|'redo')=>void run(async(current)=>{
        if(!replacements?.source||!recent||replacements.hasPending())return
        setReplacementNotice(null);setReview(null)
        if(!await beforeNavigate()){if(current())setReplacementNotice('blocked');return}
        if(!current())return
        try{const value=await replacements.source.reverse({originRequestId:recent,direction});if(current())setReview(value)}
        catch(error){if(current())setReplacementNotice(replacementError(error))}
    })
    const applyReplacement=()=>void run(async(current)=>{
        if(!replacements||!review||reviewEdited||replacements.readOnly||replacements.hasPending()||!review.canApply)return
        if(!await beforeNavigate()){if(current())setReplacementNotice('blocked');return}
        if(!current())return
        try{
            const ack=await replacements.start(review)
            if(current()&&ack){setReview(null);setPage(null);setApplied(null);setSelected([]);setRecent(ack.originRequestId);setReplacementNotice('saved')}
        }catch(error){if(current())setReplacementNotice(replacementError(error))}
    })
    const parts=story.parts.filter((part)=>!part.trashedAt),partIds=new Set(parts.map((part)=>part.id))
    const chapters=story.chapters.filter((chapter)=>!chapter.trashedAt&&(chapter.partId===null||partIds.has(chapter.partId)))
    const scopeOptions=[{value:'novel',label:copy('whole')},...parts.map((part)=>({value:'part:'+part.id,label:copy('part',{title:part.title})})),
        ...chapters.flatMap((chapter)=>[{value:'chapter:'+chapter.id,label:copy('chapter',{title:chapter.title})},...chapter.scenes.filter((scene)=>!scene.trashedAt).map((scene)=>({value:'scene:'+scene.id,label:chapter.title+' · '+scene.title}))])]
    return <Drawer open onClose={onClose} title={copy('title')} icon={<Icon icon={Search}/>} size="xl">
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{copy('help')}</p>
            {replacements?.form.recovery&&<Button variant="secondary" disabled={busy} onClick={()=>{replacements.form.resume();setReview(null);setPage(null);setApplied(null);setSelected([])}}>{replaceCopy('resume')}</Button>}
            {replacements?.form.storageFailed&&<Callout tone="warning" role="status">{replaceCopy('formStorageFailed')}</Callout>}
            <form className="space-y-3" onSubmit={(event)=>{event.preventDefault();search()}}>
                <Field label={copy('query')} error={q&&!valid?copy('invalid'):undefined}><Input value={q} maxLength={510} onChange={(event)=>updateForm({q:event.target.value})} disabled={busy} autoFocus/></Field>
                <Field label={copy('scope')}><Select value={scope} onChange={(scope)=>updateForm({scope})} options={scopeOptions} disabled={busy}/></Field>
                <Field label={copy('status')}><Select value={status} onChange={(status)=>updateForm({status})} disabled={busy} options={[{value:'',label:copy('anyStatus')},...(['draft','revising','complete','archived'] as const).map((value)=>({value,label:t('novelEditor.structure.statuses.'+value)}))]}/></Field>
                <SwitchRow label={copy('case')} checked={caseSensitive} onChange={(caseSensitive)=>updateForm({caseSensitive})} disabled={busy}/>
                <SwitchRow label={copy('archives')} checked={includeArchived} onChange={(includeArchived)=>updateForm({includeArchived})} disabled={busy}/>
                <Button type="submit" disabled={busy||!valid}>{copy(busy?'working':'run')}</Button>
            </form>
            {error&&<Callout tone="warning" role="alert">{copy(error)}</Callout>}
            {edited&&<Callout role="status">{copy('edited')}</Callout>}
            {replacements&&<section className="space-y-3" aria-label={replaceCopy('title')}>
                <h3 className="font-display text-h3 text-parchment-50">{replaceCopy('title')}</h3>
                <p className="text-body text-parchment-200">{replaceCopy('help')}</p>
                <Field label={replaceCopy('replacement')} error={!replacementValid?replaceCopy('invalid'):undefined}><Textarea value={replacement} maxLength={4000} rows={3} disabled={busy||replacements.readOnly} onChange={(event)=>updateForm({replacement:event.target.value})}/></Field>
                <p role="status" className="text-caption text-parchment-300">{replaceCopy('selected',{count:selected.length})}</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={busy||edited||!page?.items.length||replacements.readOnly} onClick={()=>setSelected(page?.items.slice(0,100).map(matchKey)??[])}>{replaceCopy('selectLoaded')}</Button>
                    <Button variant="ghost" disabled={busy||!selected.length} onClick={()=>setSelected([])}>{replaceCopy('clearSelection')}</Button>
                    <Button variant="secondary" disabled={busy||!replacementRequest?.targets.length||!replacementValid||edited||replacements.hasPending()} onClick={reviewReplacement}>{replaceCopy(busy?'working':'preview')}</Button>
                </div>
            </section>}
            {replacementNotice&&<Callout tone={replacementNotice==='saved'?'info':'warning'} role="status">{replaceCopy(replacementNotice)}</Callout>}
            {reviewEdited&&<Callout role="status">{replaceCopy('edited')}</Callout>}
            {review&&<NovelReplacementReview review={review} busy={busy} disabled={Boolean(reviewEdited||replacements?.readOnly||replacements?.hasPending())} onApply={applyReplacement} onClose={()=>setReview(null)}/>}
            {page&&<>
                <p role="status" className="text-caption text-parchment-300">{copy('counts',{count:page.items.length,scenes:page.matchingScenes,searched:page.scenesSearched})}</p>
                {!page.items.length&&<p className="text-body text-parchment-300">{copy('empty')}</p>}
                <ol className="space-y-2" aria-label={copy('results')}>
                    {page.items.map((match)=><li key={match.sceneId+':'+match.position}>
                        {replacements&&<SwitchRow variant="plain" label={replaceCopy('select',{index:page.items.indexOf(match)+1,title:match.title})} checked={selected.includes(matchKey(match))} disabled={busy||edited||replacements.readOnly||selected.length>=100&&!selected.includes(matchKey(match))}
                            onChange={(checked)=>setSelected((old)=>checked?[...old,matchKey(match)]:old.filter((key)=>key!==matchKey(match)))}/>}
                        <Button variant="ghost" className="h-auto w-full flex-col items-start gap-2 whitespace-normal border border-parchment-50/10 p-3 text-left" disabled={busy||edited||error==='changed'} onClick={()=>choose(match)}>
                            <span className="text-label text-parchment-100">{[match.partTitle,match.chapterTitle,match.title].filter(Boolean).join(' · ')}</span>
                            {match.readOnly&&<Badge>{copy('reader')}</Badge>}
                            <span className="w-full break-words whitespace-pre-wrap font-narrative text-body text-parchment-200">{match.beforeCut?'…':''}{match.before}<mark className="bg-ember-500/20 text-parchment-50">{match.quote}</mark>{match.after}{match.afterCut?'…':''}</span>
                            <span className="text-caption text-parchment-400">{copy('open')}</span>
                        </Button>
                    </li>)}
                </ol>
                {page.nextCursor&&<Button variant="secondary" disabled={busy||edited||error==='changed'} onClick={more}>{copy('more')}</Button>}
            </>}
            {replacements&&replacements.history.length>0&&<section className="space-y-3" aria-label={replaceCopy('recent')}>
                <Field label={replaceCopy('recent')}><Select value={recent} onChange={setRecent} disabled={busy} options={[{value:'',label:replaceCopy('chooseRecent')},...replacements.history.map((item)=>({value:item.originRequestId,label:replaceCopy('historyItem',{query:item.q,replacement:item.replacement||replaceCopy('deletion')})}))]}/></Field>
                <p className="text-caption text-parchment-300">{replaceCopy('historyHelp')}</p>
                <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy||!recent||replacements.hasPending()} onClick={()=>reviewReverse('undo')}>{replaceCopy('undo')}</Button>
                    <Button variant="secondary" disabled={busy||!recent||replacements.hasPending()} onClick={()=>reviewReverse('redo')}>{replaceCopy('redo')}</Button></div>
            </section>}
        </div>
    </Drawer>
}
