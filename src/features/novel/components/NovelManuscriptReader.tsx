import { ApiError } from '@/infrastructure/api'
import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline,StoryAnnotationPoint } from '@/shared'
import type { StoryReadingItem,StoryReadingPage } from '@/shared/types/storyReading.types'
import { Button,Callout,Drawer,Field,Modal,Select } from '@/ui/primitives'
import { useNovelDevicePreferences } from '../hooks/useNovelDevicePreferences'
import { useManuscriptReading,MAX_READER_PAGES,DEFAULT_MANUSCRIPT_SCOPE,isManuscriptReadingScope,type ReadingScope } from '../hooks/useManuscriptReading'
import { useReaderPosition } from '../hooks/useReaderPosition'
import { captureReaderPosition,readReaderPosition } from '../utils/readerPosition'
import type { ManuscriptReadingSource } from '../hooks/useManuscriptReadingSource'
import { readingAttributes,type ReadingPreferences } from '../utils/readingPreferences'
import { chaptersFor } from '../utils/novelUtils'
import { snapshotLabel } from '../utils/codexUtils'
import { ManuscriptProse } from './ManuscriptProse'

interface Props {
    open:boolean;source:ManuscriptReadingSource|null;story:StoryOutline;preferences:ReadingPreferences
    preferenceKey?:string|null;activeChapterId?:string;activeSceneId?:string;onClose:()=>void
    onOpenScene:(page:StoryReadingPage,item:StoryReadingItem)=>Promise<boolean>
    onBookmark?:(page:StoryReadingPage,item:StoryReadingItem,point:StoryAnnotationPoint)=>Promise<boolean>
}
export function NovelManuscriptReader(props:Props){
    const {t}=useTranslation()
    const scrollRootRef=useRef<HTMLDivElement>(null),captureCloseRef=useRef<(()=>void)|null>(null),bookmarkActionRef=useRef<(()=>Promise<void>)|null>(null)
    const [bookmarkBusy,setBookmarkBusy]=useState(false)
    const close=()=>{captureCloseRef.current?.();props.onClose()}
    return <Drawer open={props.open} onClose={close} bodyRef={scrollRootRef} size="2xl" title={t('novelEditor.reader.title')} footer={props.onBookmark?<Button variant="secondary" disabled={!props.open||!props.source||bookmarkBusy} aria-busy={bookmarkBusy} onClick={()=>void bookmarkActionRef.current?.()}>{t('novelEditor.bookmarks.readerAdd')}</Button>:undefined}>
        {props.open&&props.source&&<ReaderBody key={props.source.key} {...props} onClose={close} source={props.source} scrollRootRef={scrollRootRef} captureCloseRef={captureCloseRef} bookmarkActionRef={bookmarkActionRef} onBookmarkBusy={setBookmarkBusy}/>}
    </Drawer>
}
function ReaderBody({source,story,preferences,preferenceKey,activeChapterId,activeSceneId,onOpenScene,onClose,onBookmark,scrollRootRef,captureCloseRef,bookmarkActionRef,onBookmarkBusy}:Props&{source:ManuscriptReadingSource;scrollRootRef:RefObject<HTMLDivElement|null>;captureCloseRef:RefObject<(()=>void)|null>;bookmarkActionRef:RefObject<(()=>Promise<void>)|null>;onBookmarkBusy:(busy:boolean)=>void}){
    const {t}=useTranslation(),copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.reader.'+key,options)
    const savedScope=useNovelDevicePreferences(preferenceKey?preferenceKey+':reader-scope':null,DEFAULT_MANUSCRIPT_SCOPE,isManuscriptReadingScope)
    const scope=savedScope.preferences,setScope=savedScope.setPreferences
    const seed=useMemo(()=>readReaderPosition(preferenceKey?preferenceKey+':reader-position':null,scope),[preferenceKey,scope])
    const contents=useRef<HTMLDivElement>(null),beforeChange=useRef<((id?:string)=>void)|null>(null),visibleScene=useRef<(()=>string|null)|null>(null)
    const reading=useManuscriptReading(source,scope,seed.position?.sceneId??null,(id)=>beforeChange.current?.(id),()=>visibleScene.current?.()??null),sentinel=useRef<HTMLDivElement>(null)
    const latest=useRef(reading),alive=useRef(true)
    const position=useReaderPosition({source,scope,preferenceKey,seed,appearance:JSON.stringify(readingAttributes(preferences)),rootRef:scrollRootRef,contentsRef:contents,pages:reading.pages,busy:reading.busy,
        onEdge:(direction)=>{const value=latest.current;if(value.busy||value.error)return;if(direction==='next')value.loadMore(true);else value.loadPrevious(true)}})
    useLayoutEffect(()=>{
        latest.current=reading;beforeChange.current=position.beforePageChange;visibleScene.current=position.visibleSceneId;captureCloseRef.current=position.capture
        return()=>{if(captureCloseRef.current===position.capture)captureCloseRef.current=null}
    },[reading,position.beforePageChange,position.visibleSceneId,position.capture,captureCloseRef])
    const [opening,setOpening]=useState<string|null>(null),[openError,setOpenError]=useState<'openBlocked'|'readOnlyOpen'|null>(null)
    const [bookmarkError,setBookmarkError]=useState<'readerChanged'|'readerUnavailable'|'readOnly'|null>(null),bookmarkFlight=useRef(false)
    const bookmark=useCallback(async()=>{
        if(!onBookmark||bookmarkFlight.current||opening||!source.isCurrent())return
        const root=scrollRootRef.current,body=contents.current
        const captured=root&&body?captureReaderPosition(root,body,reading.pages,scope,JSON.stringify(readingAttributes(preferences))):null
        const page=captured?reading.pages.find((page)=>page.items.some((item)=>item.header.sceneId===captured.sceneId)):undefined
        const item=page?.items.find((item)=>item.header.sceneId===captured?.sceneId)
        if(!captured?.nodeId){setBookmarkError('readerUnavailable');return}
        if(!page||!item||item.header.contentHash!==captured.contentHash){setBookmarkError('readerChanged');return}
        if(item.header.readOnly){setBookmarkError('readOnly');return}
        bookmarkFlight.current=true;setBookmarkError(null);onBookmarkBusy(true)
        try{const ok=await onBookmark(page,item,{nodeId:captured.nodeId,offset:0});if(alive.current&&source.isCurrent()&&!ok)setBookmarkError('readerChanged')}
        catch{if(alive.current&&source.isCurrent())setBookmarkError('readerChanged')}
        finally{bookmarkFlight.current=false;onBookmarkBusy(false)}
    },[onBookmark,opening,reading.pages,source,scope,preferences,scrollRootRef,onBookmarkBusy])
    useLayoutEffect(()=>{bookmarkActionRef.current=bookmark;return()=>{if(bookmarkActionRef.current===bookmark)bookmarkActionRef.current=null}},[bookmark,bookmarkActionRef])
    const [reference,setReference]=useState<{id:string;label:string;contextRevision:number}|null>(null)
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    const last=reading.pages[reading.pages.length-1],head=reading.pages[0],hasNext=Boolean(last?.nextAfterSceneId)
    useEffect(()=>{
        const element=sentinel.current
        if(!element||!hasNext||reading.busy||reading.error||reading.pages.length>=MAX_READER_PAGES||typeof IntersectionObserver==='undefined')return
        const observer=new IntersectionObserver((entries)=>{if(entries.some((entry)=>entry.isIntersecting))latest.current.loadMore(true)})
        observer.observe(element);return()=>observer.disconnect()
    },[hasNext,reading.busy,reading.error,last,reading.pages.length])
    const chapters=useMemo(()=>chaptersFor(story),[story])
    const units=scope.scope==='part'?story.parts.filter((part)=>!part.trashedAt).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))
        :scope.scope==='chapter'?chapters:chapters.flatMap((chapter)=>chapter.scenes.filter((scene)=>!scene.trashedAt).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)))
    const chooseScope=(value:string)=>{
        position.capture()
        const kind=value as ReadingScope['scope'],selected=kind==='chapter'?activeChapterId:kind==='scene'?activeSceneId:undefined
        const candidates=kind==='part'?story.parts.filter((part)=>!part.trashedAt):kind==='chapter'?chapters:chapters.flatMap((chapter)=>chapter.scenes.filter((scene)=>!scene.trashedAt))
        setScope({...scope,scope:kind,unitId:kind==='novel'?null:candidates.find((unit)=>unit.id===selected)?.id??candidates[0]?.id??null});setOpenError(null)
    }
    async function openScene(page:StoryReadingPage,item:StoryReadingItem){
        if(opening||!source.isCurrent())return
        setOpening(item.header.sceneId);setOpenError(null)
        try{const ok=await onOpenScene(page,item);if(alive.current&&source.isCurrent()){if(ok)onClose();else setOpenError('openBlocked')}}
        catch(error){if(alive.current&&source.isCurrent())setOpenError(error instanceof ApiError&&error.code==='STORY_READING_WORKSPACE_READONLY'?'readOnlyOpen':'openBlocked')}
        finally{if(alive.current)setOpening(null)}
    }
    const referenced=head&&reference&&reference.contextRevision===head.sourceContextRevision&&reference.contextRevision===story.contextRevision?story.activeCardRefs.find((ref)=>ref.id===reference.id):undefined
    const loaded=reading.pages.reduce((sum,page)=>sum+page.items.length,0)
    const items=reading.pages.flatMap((page)=>page.items.map((item)=>({page,item})))
    return <div className="novel-reading-room novel-reading-surface space-y-5" {...readingAttributes(preferences)}>
        <p className="text-body text-parchment-300">{copy('savedOnly')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label={copy('scope')}><Select value={scope.scope} disabled={Boolean(opening)} onChange={chooseScope} options={(['novel','part','chapter','scene'] as const).map((kind)=>({value:kind,label:copy('scopes.'+kind),disabled:kind==='part'&&!story.parts.some((unit)=>!unit.trashedAt)||kind==='chapter'&&!chapters.length||kind==='scene'&&!chapters.some((unit)=>unit.scenes.some((scene)=>!scene.trashedAt))}))}/></Field>
            {scope.scope!=='novel'&&<Field label={copy('unit')}><Select value={scope.unitId??''} disabled={Boolean(opening)} onChange={(unitId)=>{position.capture();setScope({...scope,unitId});setOpenError(null)}} options={units.map((unit)=>({value:unit.id,label:unit.title}))}/></Field>}
        </div>
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={Boolean(opening)} aria-pressed={scope.includeArchived} onClick={()=>{position.capture();setScope({...scope,includeArchived:!scope.includeArchived})}}>{copy('includeArchived')}</Button>
            <Button size="sm" variant="ghost" disabled={reading.busy||Boolean(opening)} onClick={()=>{const sceneId=position.prepareRefresh();if(sceneId)reading.seek(sceneId);else reading.refresh()}}>{copy('refresh')}</Button>
            <Button size="sm" variant="ghost" disabled={reading.busy||Boolean(opening)} onClick={()=>{position.beginning();reading.beginning()}}>{copy('beginning')}</Button>
        </div>
        {head&&<p className="text-caption text-parchment-300" role="status">{copy('windowProgress',{from:loaded?head.offset+1:0,through:head.offset+loaded,total:head.totalScenes})}</p>}
        {preferenceKey&&savedScope.storageUnavailable&&<Callout tone="warning" role="status">{copy('scopeUnavailable')}</Callout>}
        {preferenceKey&&position.storageUnavailable&&<Callout tone="warning" role="status">{copy('positionStorageUnavailable')}</Callout>}
        {position.changed&&<Callout tone="warning" role="status">{copy('positionChanged')}</Callout>}
        {reading.error&&<Callout tone="warning" role="alert">{copy(reading.error)}</Callout>}
        {openError&&<Callout tone="warning" role="alert">{copy(openError)}</Callout>}
        {bookmarkError&&<Callout tone="warning" role="alert">{t('novelEditor.bookmarks.'+bookmarkError)}</Callout>}
        {head&&!head.totalScenes&&!reading.busy&&<p className="text-body text-parchment-300">{copy('empty')}</p>}
        {head?.navigation?.previousBeforeSceneId&&<Button variant="secondary" disabled={reading.busy||Boolean(reading.error)||Boolean(opening)} onClick={()=>reading.loadPrevious()}>{copy('previous')}</Button>}
        <div ref={contents} className="space-y-6" aria-label={copy('contents')} tabIndex={-1}>
            {items.map(({page,item},index)=>{
                const h=item.header,previous=items[index-1]?.item.header??{partId:head?.navigation?.previousPartId,chapterId:head?.navigation?.previousChapterId},newPart=h.partId!==previous.partId,newChapter=h.chapterId!==previous.chapterId
                return <section key={h.sceneId} data-reader-scene-id={h.sceneId} aria-label={h.title} className="min-w-0 space-y-3">
                    {newPart&&h.partTitle&&<h2 className="break-words font-display text-h2">{h.partTitle}</h2>}
                    {newChapter&&<h2 className="break-words font-display text-h3">{h.chapterTitle}</h2>}
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
                        <h3 className="min-w-0 break-words font-display text-h3">{h.title}</h3>
                        <Button size="sm" variant="ghost" className="max-w-full" disabled={Boolean(opening)} onClick={()=>void openScene(page,item)}><span className="min-w-0 whitespace-normal break-words text-start">{copy('openScene',{title:h.title})}</span></Button>
                    </div>
                    {h.archived&&<p className="text-caption text-parchment-300">{copy('archived')}</p>}
                    <ManuscriptProse document={item.scene.document} onReference={(id,label)=>setReference({id,label,contextRevision:page.sourceContextRevision})}/>
                </section>
            })}
        </div>
        <div ref={sentinel} className="flex flex-wrap gap-2" aria-live="polite">
            {reading.busy&&<p className="text-body text-parchment-300" role="status">{copy('loading')}</p>}
            {hasNext&&<Button variant="secondary" disabled={reading.busy||reading.error==='changed'||reading.error==='positionUnavailable'||Boolean(opening)} onClick={()=>reading.loadMore()}>{copy('more')}</Button>}
            {!reading.busy&&reading.error==='failed'&&!head&&<Button variant="secondary" onClick={reading.refresh}>{copy('retry')}</Button>}
            {head&&!hasNext&&!reading.busy&&head.totalScenes>0&&<p className="text-caption text-parchment-300">{copy('end')}</p>}
        </div>
        <Modal open={Boolean(reference)} onClose={()=>setReference(null)} title={copy('referenceTitle')} size="lg">
            <p className="mb-3 text-caption text-parchment-300">{reference&&copy('referenceLabel',{label:reference.label})}</p>
            {referenced?<div className="space-y-3"><h3 className="font-display text-h3">{snapshotLabel(referenced)}</h3>
                <p className="text-caption text-parchment-300">{referenced.snapshot.source_card_version_number!=null?copy('version',{number:referenced.snapshot.source_card_version_number}):copy('localSnapshot')}</p>
                <p className="whitespace-pre-wrap break-words font-narrative text-body">{referenced.snapshot.description}</p>
                {referenced.removedAt&&<p className="text-caption text-parchment-300">{copy('removedReference')}</p>}
            </div>:<Callout tone="warning">{copy('referenceUnavailable')}</Callout>}
        </Modal>
    </div>
}
