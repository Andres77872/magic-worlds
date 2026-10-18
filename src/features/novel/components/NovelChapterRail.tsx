/** The outline selects scenes without replacing their canonical documents. */
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ListTree, Plus, Settings2 } from 'lucide-react'
import { memo,useCallback,useId,useLayoutEffect,useMemo,useRef,useState,type DragEvent,type RefObject } from 'react'
import type { StoryChapterOutline, StoryPart, StoryCardRef,StoryStructureOperation } from '@/shared'
import { Badge, Button, Chip,Icon, IconButton, cx } from '@/ui/primitives'
import { novelOutline,DEFAULT_OUTLINE_VIEW,type OutlineView,type OutlineChapter } from '../utils/novelOutline'
import { NovelOutlineDetails } from './NovelOutlineDetails'

export interface OutlineTarget {kind:'novel'|'part'|'chapter'|'scene';id:string}
interface NovelChapterRailProps {
    chapters:StoryChapterOutline[]
    parts?:StoryPart[]
    activeChapterId:string|null
    activeSceneId?:string|null
    onSelect:(id:string)=>void
    onAdd:()=>void
    /** Opens the outline import (S18); absent where the outline cannot change. */
    onImportOutline?:()=>void
    onManage?:(target:OutlineTarget)=>void
    onMove?:(operation:StoryStructureOperation)=>void
    readOnly?:boolean
    references?:StoryCardRef[]
    view?:OutlineView
    onViewChange?:(view:OutlineView)=>void
}
const DRAG_TYPE='application/x-reverie-manuscript-item'
/** Above this many scenes, chapters start with their scenes hidden except the open one, so the outline stays quick. */
export const LARGE_OUTLINE_SCENES=200
interface OutlineActions {onSelect:(id:string)=>void;onManage?:(target:OutlineTarget)=>void;onMove?:(operation:StoryStructureOperation)=>void}
const NO_PARTS:StoryPart[]=[],NO_REFERENCES:StoryCardRef[]=[]

export function NovelChapterRail({chapters,parts=NO_PARTS,references=NO_REFERENCES,activeChapterId,activeSceneId,onSelect,onAdd,onImportOutline,onManage,onMove,readOnly=false,view:controlledView,onViewChange}:NovelChapterRailProps) {
    const {t}=useTranslation()
    const [localView,setLocalView]=useState(DEFAULT_OUTLINE_VIEW),view=controlledView??localView
    const outline=useMemo(()=>novelOutline(chapters,parts),[chapters,parts])
    const changeView=(value:OutlineView)=>{setLocalView(value);onViewChange?.(value)}
    const detailCopy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.outline.'+key,values)
    const collapsed=useMemo(()=>[...outline.ungrouped,...outline.parts.flatMap((part)=>part.chapters)]
        .reduce((total,chapter)=>total+chapter.scenes.length,0)>LARGE_OUTLINE_SCENES,[outline])
    // The author's own show/hide choices; every other chapter follows the novel's size.
    const [toggled,setToggled]=useState<ReadonlyMap<string,boolean>>(()=>new Map())
    const toggle=useCallback((id:string,expanded:boolean)=>setToggled((old)=>new Map(old).set(id,!expanded)),[])
    // The Studio passes new handlers on every render. The tree reads the latest ones, so typing does not re-render it.
    const actions=useRef<OutlineActions>({onSelect,onManage,onMove})
    useLayoutEffect(()=>{actions.current={onSelect,onManage,onMove}})
    return <aside aria-label={t('novelEditor.structure.title')} className="flex min-h-0 min-w-0 flex-col gap-3 border-r border-line bg-ink-900/35 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2"><h2 className="font-ui text-eyebrow text-parchment-400">{t('novelEditor.chapters.title')}</h2><span className="font-mono text-caption text-parchment-400" aria-label={detailCopy('activeWords',{count:outline.words})}>{outline.words?.toLocaleString()??'—'}</span></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={detailCopy('view')}><Chip active={view.numbers} aria-pressed={view.numbers} onClick={()=>changeView({...view,numbers:!view.numbers})}>{detailCopy('numbers')}</Chip><Chip active={view.details} aria-pressed={view.details} onClick={()=>changeView({...view,details:!view.details})}>{detailCopy('details')}</Chip></div>
        {view.numbers&&<p className="text-caption text-parchment-400">{detailCopy('numberHelp')}</p>}
        {collapsed&&<p className="text-caption text-parchment-400">{detailCopy('collapsedHelp')}</p>}
        <OutlineTree outline={outline} view={view} references={references} activeChapterId={activeChapterId} activeSceneId={activeSceneId??null} readOnly={readOnly}
            canManage={Boolean(onManage)} canMove={Boolean(onMove)} collapsed={collapsed} toggled={toggled} onToggle={toggle} actions={actions}/>
        <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={onAdd} disabled={readOnly} data-testid="novel-chapter-add"><Icon icon={Plus} size={14}/>{t('novelEditor.chapters.add')}</Button>
            {onImportOutline&&<Button variant="ghost" size="sm" onClick={onImportOutline} disabled={readOnly} data-testid="novel-outline-import"><Icon icon={ListTree} size={14}/>{t('novelEditor.outlineImport.open')}</Button>}
        </div>
    </aside>
}

interface OutlineTreeProps {
    outline:ReturnType<typeof novelOutline>
    view:OutlineView
    references:StoryCardRef[]
    activeChapterId:string|null
    activeSceneId:string|null
    readOnly:boolean
    canManage:boolean
    canMove:boolean
    collapsed:boolean
    toggled:ReadonlyMap<string,boolean>
    onToggle:(id:string,expanded:boolean)=>void
    actions:RefObject<OutlineActions>
}
const OutlineTree=memo(function OutlineTree({outline,view,references,activeChapterId,activeSceneId,readOnly,canManage,canMove,collapsed,toggled,onToggle,actions}:OutlineTreeProps) {
    const {t}=useTranslation()
    const numberId=useId()
    const copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.structure.'+key,options)
    const detailCopy=(key:string,values?:Record<string,unknown>)=>t('novelEditor.outline.'+key,values)
    const ordinalId=(kind:string,id:string)=>numberId+'-'+kind+'-'+encodeURIComponent(id)
    function drop(event:DragEvent,kind:'part'|'chapter'|'scene',parentId:string|null,beforeId?:string) {
        if (readOnly||!canMove||!event.dataTransfer.types.includes(DRAG_TYPE)) return
        event.preventDefault()
        try {
            const item=JSON.parse(event.dataTransfer.getData(DRAG_TYPE))
            if (item.kind!==kind||typeof item.id!=='string'||item.id===beforeId) return
            actions.current.onMove?.({op:'move',kind,id:item.id,parentId,beforeId})
        } catch { /* Only this outline's explicit item payload is accepted. */ }
    }
    function drag(event:DragEvent,kind:string,id:string) {event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(DRAG_TYPE,JSON.stringify({kind,id}))}
    function allow(event:DragEvent) {if(!readOnly&&canMove&&event.dataTransfer.types.includes(DRAG_TYPE))event.preventDefault()}
    const settings=(kind:OutlineTarget['kind'],id:string,title:string)=>canManage&&<IconButton label={copy('settings',{title})} size="sm" onClick={()=>actions.current.onManage?.({kind,id})}><Icon icon={Settings2} size={14}/></IconButton>
    const rows=(items:OutlineChapter[])=>items.map(({unit:chapter,number,words,archived,scenes})=>{
        const active=chapter.id===activeChapterId
        const expanded=toggled.get(chapter.id)??(!collapsed||active)
        const listId=ordinalId('scenes',chapter.id)
        return <li key={chapter.id} className="min-w-0" onDragOver={allow} onDrop={(event)=>{event.stopPropagation();drop(event,'chapter',chapter.partId,chapter.id)}}>
            <div className="flex min-w-0 items-center gap-1">
                {scenes.length>0&&<IconButton size="sm" aria-expanded={expanded} aria-controls={expanded?listId:undefined} onClick={()=>onToggle(chapter.id,expanded)}
                    label={expanded?detailCopy('hideScenes',{title:chapter.title}):detailCopy('showScenes',{count:scenes.length,title:chapter.title})}><Icon icon={expanded?ChevronDown:ChevronRight} size={14}/></IconButton>}
                <Button variant="ghost" size="sm" className={cx('min-w-0 flex-1 justify-start truncate',active&&'text-ember-300')} onClick={()=>actions.current.onSelect(chapter.id)} aria-label={chapter.title} aria-describedby={view.numbers&&number!==null?ordinalId('chapter',chapter.id):undefined}
                    draggable={!readOnly&&!archived&&!chapter.inheritance?.readOnly} onDragStart={(event)=>drag(event,'chapter',chapter.id)} data-testid="novel-chapter-row">
                    {view.numbers&&number!==null&&<><span className="sr-only" id={ordinalId('chapter',chapter.id)}>{detailCopy('chapterNumber',{number})}</span><span className="font-mono text-caption text-parchment-400" aria-hidden="true">{number}.</span></>}<span className="truncate">{chapter.title}</span>
                </Button>{settings('chapter',chapter.id,chapter.title)}
                {!view.details&&archived&&<Badge>{copy('statuses.archived')}</Badge>}
            </div>
            {view.details&&<NovelOutlineDetails unit={chapter} words={words} archived={archived} references={references.length?references:('activeCardRefs' in chapter?chapter.activeCardRefs as StoryCardRef[]:[])} chapterId={chapter.id}/>}
            {expanded&&<ol id={listId} className="space-y-1 border-l border-line pl-3">
                {scenes.map(({unit:scene,number,words,archived})=><li key={scene.id} className="min-w-0" onDragOver={allow} onDrop={(event)=>{event.stopPropagation();drop(event,'scene',chapter.id,scene.id)}}>
                    <div className="flex min-w-0 items-center gap-1">
                    <Button variant="ghost" size="sm" className={cx('min-w-0 flex-1 justify-start',scene.id===activeSceneId&&'bg-ember-500/10 text-ember-300')}
                        aria-current={scene.id===activeSceneId?'page':undefined} aria-label={scene.title} aria-describedby={view.numbers&&number!==null?ordinalId('scene',scene.id):undefined} onClick={()=>actions.current.onSelect(scene.id)} draggable={!readOnly&&!archived&&!scene.inheritance?.readOnly} onDragStart={(event)=>drag(event,'scene',scene.id)}>
                        {view.numbers&&number!==null&&<><span className="sr-only" id={ordinalId('scene',scene.id)}>{detailCopy('sceneNumber',{number})}</span><span className="font-mono text-caption text-parchment-400" aria-hidden="true">{number}</span></>}<span className="min-w-0 flex-1 truncate text-left">{scene.title}</span>
                        <span className="font-mono text-caption text-parchment-400"><span aria-label={words===null?t('novelEditor.loading.wordsUnavailable'):undefined}>{words?.toLocaleString()??'—'}</span></span>
                    </Button>{settings('scene',scene.id,scene.title)}
                    {!view.details&&archived&&<Badge>{copy('statuses.archived')}</Badge>}</div>
                    {view.details&&<NovelOutlineDetails unit={scene} words={words} archived={archived} references={references.length?references:('activeCardRefs' in scene?scene.activeCardRefs as StoryCardRef[]:[])} chapterId={chapter.id} sceneId={scene.id}/>}
                </li>)}
            </ol>}
        </li>
    })
    return <nav aria-label={copy('title')} className="min-h-0 flex-1 overflow-y-auto">
        <ol className="space-y-3" onDragOver={allow} onDrop={(event)=>drop(event,'chapter',null)}>{rows(outline.ungrouped)}</ol>
        {outline.parts.map(({unit:part,number,words,archived,chapters})=><section key={part.id} className="mt-4 min-w-0" onDragOver={allow} onDrop={(event)=>{event.stopPropagation();drop(event,'chapter',part.id)}}>
            <div className="flex items-center gap-1"><h3 className="min-w-0 flex-1 truncate font-ui text-eyebrow text-parchment-400">{view.numbers&&number!==null&&<span aria-label={detailCopy('partNumber',{number})}>{number}. </span>}{part.title}</h3>{settings('part',part.id,part.title)}{!view.details&&archived&&<Badge>{copy('statuses.archived')}</Badge>}</div>
            {view.details&&<NovelOutlineDetails unit={part} words={words} archived={archived} references={references}/>}
            <ol className="space-y-3">{rows(chapters)}</ol>
        </section>)}
    </nav>
})
