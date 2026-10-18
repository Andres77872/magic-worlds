import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline,StoryCopyOptions,StoryStructureOperation,StoryAnnotationCopyPreview } from '@/shared'
import { defaultStoryCopyOptions } from '@/shared/storyCopyOptions'
import { unitCopyOperation,unitCopyScenes,unitCopySource } from '@/shared/storyUnitCopy'
import { Button,Callout,Field,Input,Modal,SwitchRow } from '@/ui/primitives'
import { sumSceneWords } from '../utils/novelOutline'
import { loadedStoryScene } from '@/shared/storyStudioState'
import { NovelSceneExcerpts,type SceneExcerptReader } from './NovelSceneExcerpts'

interface Props {
    source:{kind:'chapter'|'scene';id:string;title:string}
    loadSource:()=>Promise<StoryOutline|null>
    loadAnnotations?:()=>Promise<StoryAnnotationCopyPreview|null>
    readExcerpts?:SceneExcerptReader
    loadBookmarks?:()=>Promise<StoryAnnotationCopyPreview|null>
    beforeWrite:()=>Promise<boolean>
    operate:(operation:StoryStructureOperation)=>Promise<StoryOutline|null>
    pendingOperation?:StoryStructureOperation|null
    operationError?:string|null
    clearError?:()=>void
    busy?:boolean
    onClose:()=>void
}
export function NovelUnitCopyModal({source,loadSource,loadAnnotations,loadBookmarks,readExcerpts,beforeWrite,operate,pendingOperation,operationError,clearError,busy=false,onClose}:Props){
    const {t}=useTranslation(),text=(key:string,options?:Record<string,unknown>)=>t('novelEditor.unitCopy.'+key,options)
    const waiting=pendingOperation?.op==='duplicate'&&pendingOperation.kind===source.kind&&pendingOperation.id===source.id?pendingOperation:null
    const [title,setTitle]=useState(()=>waiting?.title??Array.from(t('novelEditor.copyNovel.defaultTitle',{title:source.title})).slice(0,255).join('').trim())
    const [options,setOptions]=useState<StoryCopyOptions>(()=>({...waiting?.options??defaultStoryCopyOptions}))
    const [includeComments,setIncludeComments]=useState(true)
    const [includeBookmarks,setIncludeBookmarks]=useState(false)
    const [snapshot,setSnapshot]=useState<{story:StoryOutline|null;annotations?:StoryAnnotationCopyPreview;bookmarks?:StoryAnnotationCopyPreview;phase:'loading'|'ready'|'blocked'|'failed'}>({story:null,phase:'loading'})
    const [excerptsReady,setExcerptsReady]=useState(false)
    const [reload,setReload]=useState(0),[applying,setApplying]=useState(false),[error,setError]=useState(false)
    const mounted=useRef(true),flight=useRef(false),loader=useRef(loadSource),annotationLoader=useRef(loadAnnotations),bookmarkLoader=useRef(loadBookmarks),pendingRef=useRef(waiting)
    useLayoutEffect(()=>{loader.current=loadSource;annotationLoader.current=loadAnnotations;bookmarkLoader.current=loadBookmarks;pendingRef.current=waiting},[loadSource,loadAnnotations,loadBookmarks,waiting])
    useEffect(()=>{
        mounted.current=true;let current=true
        if(!pendingRef.current)loader.current().then(async(story)=>{
            if(!current)return
            const annotations=story&&annotationLoader.current?await annotationLoader.current():null
            if(!current)return
            const bookmarks=story&&bookmarkLoader.current?await bookmarkLoader.current():null
            if(story&&annotationLoader.current&&(!annotations||annotations.kind!==undefined||annotations.storyId!==story.id))throw new Error('Annotation copy source changed')
            if(story&&bookmarkLoader.current&&(!bookmarks||bookmarks.kind!=='bookmark'||bookmarks.storyId!==story.id||annotations&&bookmarks.annotationRevision!==annotations.annotationRevision))throw new Error('Bookmark copy source changed')
            if(current)setSnapshot({story,...(annotations?{annotations}:{}),...(bookmarks?{bookmarks}:{}),phase:story?'ready':'blocked'})
        })
            .catch(()=>{if(current)setSnapshot({story:null,phase:'failed'})})
        return()=>{current=false;mounted.current=false}
    },[source.kind,source.id,reload])
    const displayedOptions=useMemo(()=>waiting?.options??(waiting?{...defaultStoryCopyOptions,includeArchived:true}:options),[waiting,options]),displayedTitle=waiting?.title??title
    const selected=useMemo(()=>snapshot.story?unitCopySource(snapshot.story,source.kind,source.id):null,[snapshot.story,source.kind,source.id])
    const scenes=useMemo(()=>selected?unitCopyScenes(selected.scenes,displayedOptions):[],[selected,displayedOptions])
    const words=sumSceneWords(scenes),previewReady=scenes.every(loadedStoryScene)||excerptsReady
    const sourceReadOnly=selected&&(selected.unit.trashedAt||selected.unit.status==='archived'||selected.unit.inheritance?.readOnly)
    const hasCommentChoice=waiting?waiting.includeComments!==undefined:Boolean(loadAnnotations)
    const displayedComments=waiting?.includeComments??includeComments
    const hasBookmarkChoice=waiting?waiting.includeBookmarks!==undefined:Boolean(loadBookmarks),displayedBookmarks=waiting?.includeBookmarks??includeBookmarks
    const noteCounts=new Map(snapshot.annotations?.scenes.map((row)=>[row.sceneId,row]))
    const commentCount=scenes.reduce((total,scene)=>{const row=noteCounts.get(scene.id);return total+(row?row.open+row.resolved+(displayedOptions.includeTrash?row.trashed:0):0)},0)
    const bookmarkCounts=new Map(snapshot.bookmarks?.scenes.map((row)=>[row.sceneId,row])),bookmarkCount=scenes.reduce((total,scene)=>{const row=bookmarkCounts.get(scene.id);return total+(row?row.open+(displayedOptions.includeTrash?row.trashed:0):0)},0)
    const operation=waiting??(snapshot.story?unitCopyOperation(snapshot.story,source.kind,source.id,displayedTitle.trim(),displayedOptions,
        snapshot.annotations||snapshot.bookmarks?{included:Boolean(snapshot.annotations)&&displayedComments,revision:(snapshot.annotations??snapshot.bookmarks)!.annotationRevision,...(snapshot.bookmarks?{bookmarks:displayedBookmarks}:{})}:undefined):null)
    const locked=applying||busy||Boolean(pendingOperation)
    const blocked=Boolean(pendingOperation&&!waiting)||!waiting&&(!operation||Boolean(sourceReadOnly)||snapshot.phase!=='ready'||!previewReady)
    async function apply(){
        if(flight.current||blocked||!operation||!displayedTitle.trim())return
        flight.current=true;setApplying(true);setError(false)
        try{
            const ready=await beforeWrite()
            if(!mounted.current)return
            if(!ready){setSnapshot((old)=>({...old,phase:'blocked'}));return}
            const result=await operate(operation)
            if(mounted.current){if(result)onClose();else setError(true)}
        }catch{if(mounted.current)setError(true)}
        finally{flight.current=false;if(mounted.current)setApplying(false)}
    }
    return <Modal open title={text('title')} onClose={()=>{if(!applying)onClose()}} size="lg" footer={<>
        <Button variant="ghost" disabled={applying} onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={applying||busy||blocked||!displayedTitle.trim()} aria-busy={applying} onClick={()=>void apply()}>{text(waiting?'recover':'apply')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <Field label={text('name')}><Input value={displayedTitle} maxLength={255} disabled={locked} onChange={(event)=>setTitle(event.target.value)}/></Field>
            {(['includeNotes','includeContext',...(source.kind==='chapter'?['includeArchived','includeTrash'] as const:[])] as const).map((key)=><SwitchRow key={key} label={text(key)} description={text(key+'Help')+(key==='includeTrash'&&hasCommentChoice?' '+text('commentTrashHelp'):'')} checked={displayedOptions[key]} disabled={locked} onChange={(value)=>setOptions((old)=>({...old,[key]:value}))}/>)}
            {hasCommentChoice&&<SwitchRow label={text('includeComments')} description={text('includeCommentsHelp')} checked={displayedComments} disabled={locked} onChange={setIncludeComments}/>}
            {hasBookmarkChoice&&<SwitchRow label={t('novelEditor.bookmarks.include')} description={t('novelEditor.bookmarks.includeHelp')} checked={displayedBookmarks} disabled={locked} onChange={setIncludeBookmarks}/>}
            {waiting?<Callout tone="warning">{text('pending')}</Callout>:<>
                {snapshot.phase==='loading'&&<p role="status">{text('loading')}</p>}
                {selected&&<><p role="status">{words===null?t('novelEditor.loading.countsUnavailable',{count:scenes.length}):text('counts',{count:scenes.length,words:words.toLocaleString()})}</p>
                    {snapshot.annotations&&<p role="status">{text('commentCount',{count:displayedComments?commentCount:0})}</p>}
                    {snapshot.bookmarks&&<p role="status">{t('novelEditor.bookmarks.copyCount',{count:displayedBookmarks?bookmarkCount:0})}</p>}
                    {!scenes.length&&<Callout tone="warning">{text('empty')}</Callout>}
                    {snapshot.story&&<NovelSceneExcerpts source={snapshot.story} scenes={scenes} read={readExcerpts} onReady={setExcerptsReady}/>}</>}
                {sourceReadOnly&&<Callout tone="warning">{text('readOnly')}</Callout>}
            </>}
            {pendingOperation&&!waiting&&<Callout tone="warning">{t('novelEditor.structure.errors.pending')}</Callout>}
            {(error||operationError||!waiting&&['blocked','failed'].includes(snapshot.phase))&&<Callout tone="warning" role="alert">{text(['STORY_COPY_SOURCE_CHANGED','STORY_STRUCTURE_CONFLICT'].includes(operationError??'')?'changed':snapshot.phase==='blocked'?'blocked':'failed')}</Callout>}
            {!waiting&&<Button variant="secondary" size="sm" disabled={locked||snapshot.phase==='loading'} onClick={()=>{clearError?.();setError(false);setSnapshot({story:null,phase:'loading'});setReload((old)=>old+1)}}>{text('refresh')}</Button>}
        </div>
    </Modal>
}
