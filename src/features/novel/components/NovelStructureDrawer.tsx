import { useMemo,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '@/app/hooks'
import type { StoryOutline,StoryChapterOutline,StorySceneOutline,StoryStructureKind,StoryStructureOperation,StoryUnitMetadata } from '@/shared'
import { Button,Callout,SwitchRow,Drawer,Field,Input,Modal,Select } from '@/ui/primitives'
import { sumSceneWords } from '../utils/novelOutline'
import { loadedStoryScene,isStudioSource,studioReviewVersion } from '@/shared/storyStudioState'
import { NovelSceneExcerpts,type SceneExcerptReader } from './NovelSceneExcerpts'
import type { OutlineTarget } from './NovelChapterRail'
import { NovelUnitDetails } from './NovelUnitDetails'
import { NovelCopyOrigin } from './NovelCopyOrigin'
import { NovelCreationOrigin } from './NovelCreationOrigin'
import { NovelUnitCopyModal } from './NovelUnitCopyModal'
import { NovelStructureHistory,type StoryHistorySource } from './NovelStructureHistory'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'

interface Props {
    story:StoryOutline
    workspace:StoryWorkspace
    target:OutlineTarget
    onSelect:(target:OutlineTarget)=>void
    onClose:()=>void
    readOnly:boolean
    busy:boolean
    beforeWrite:()=>Promise<boolean>
    operate:(operation:StoryStructureOperation)=>Promise<StoryOutline|null>
    splitCursor:()=>{nodeId:string;offset:number}|null
    activeSceneId:string|null
    onCopyNovel?:()=>void
    isCurrent?:()=>boolean
    pendingOperation?:StoryStructureOperation|null
    operationError?:string|null
    clearOperationError?:()=>void
}
interface Preview {source:StoryOutline;operation?:StoryStructureOperation;rootAction?:'archive'|'trash'|'restore';label:string;scenes:StorySceneOutline[];help?:string;destination?:string}
const ownReadOnly=(item:StoryOutline|StoryUnitMetadata)=>Boolean(item.trashedAt)||item.status==='archived'||('inheritance' in item&&Boolean(item.inheritance?.readOnly))
export function NovelStructureDrawer({story,workspace,target,onSelect,onClose,readOnly,busy,beforeWrite,operate,splitCursor,activeSceneId,onCopyNovel,isCurrent=()=>true,pendingOperation,operationError,clearOperationError}:Props) {
    const {t}=useTranslation()
    const copy=(key:string,options?:Record<string,unknown>)=>t('novelEditor.structure.'+key,options)
    const {storyLifecycle,refreshStory}=useData()
    const [copyTarget,setCopyTarget]=useState<{kind:'chapter'|'scene';id:string;title:string}|null>(null)
    const [title,setTitle]=useState('')
    const [createTitle,setCreateTitle]=useState('')
    const [createKind,setCreateKind]=useState<StoryStructureKind>('chapter')
    const [container,setContainer]=useState('')
    const [beforeId,setBeforeId]=useState('')
    const [restoreSelection,setRestoreSelection]=useState<{unit:string;parentId:string}|null>(null)
    const [creation,setCreation]=useState<{key:string;parentId:string|null;position:'end'|'before'|'after'}|null>(null)
    const [excerptsReady,setExcerptsReady]=useState(false)
    const [preview,setPreview]=useState<Preview|null>(null)
    const [pending,setPending]=useState(false)
    const applying=useRef(false)
    const [error,setError]=useState<string|null>(null)
    const [sceneBreak,setSceneBreak]=useState(true)
    const [historyOpen,setHistoryOpen]=useState(false)
    const historySource=useMemo<StoryHistorySource>(()=>({key:story.id+':'+workspace.workspaceId,isCurrent:workspace.isCurrent,
        readPage:async(query)=>{const api=workspace.detachedApi();if(!api)throw new Error('History scope changed');return api.getStoryStructureRevisions(story.id,query)},
        readRevision:async(revision)=>{const api=workspace.detachedApi();if(!api)throw new Error('History scope changed');return api.getStoryStructureRevision(story.id,revision)},
        refreshStory:async()=>{if(workspace.isCurrent())await refreshStory(story.id)},
    }),[story.id,workspace,refreshStory])
    const readExcerpts:SceneExcerptReader=async(source,scenes,signal)=>{
        const api=isCurrent()&&workspace.isCurrent()?workspace.detachedApi():null
        if(!api)return null
        const result=await api.getStoryStudioExcerpts(source,scenes,{signal})
        return isCurrent()&&workspace.isCurrent()?result:null
    }
    const affected=(items:StorySceneOutline[])=>{
        const words=sumSceneWords(items)
        return words===null?t('novelEditor.loading.countsUnavailable',{count:items.length}):copy('affected',{count:items.length,words:words.toLocaleString()})
    }
    const all=[{kind:'novel' as const,unit:story},...story.parts.map((unit)=>({kind:'part' as const,unit})),...story.chapters.flatMap((unit)=>[{kind:'chapter' as const,unit},...unit.scenes.map((scene)=>({kind:'scene' as const,unit:scene}))])]
    const found=all.find((item)=>item.kind===target.kind&&item.unit.id===target.id)
    if(!found)return <Drawer open onClose={onClose} title={copy('manage')} size="lg"><Callout tone="warning" role="alert">{copy('targetUnavailable')}</Callout></Drawer>
    const {unit,kind}=found
    const rootReadOnly=ownReadOnly(story)
    const disabled=readOnly||rootReadOnly||ownReadOnly(unit)||busy||pending
    const chapter=kind==='chapter'?unit as StoryChapterOutline:kind==='scene'?story.chapters.find((chapter)=>chapter.id===(unit as StorySceneOutline).chapterId):undefined
    const scenes=kind==='novel'?story.chapters.flatMap((chapter)=>chapter.scenes):kind==='part'?story.chapters.filter((chapter)=>chapter.partId===unit.id).flatMap((chapter)=>chapter.scenes):kind==='chapter'?(unit as StoryChapterOutline).scenes:[unit as StorySceneOutline]
    const currentParent=kind==='chapter'?(unit as StoryChapterOutline).partId:kind==='scene'?(unit as StorySceneOutline).chapterId:null
    const siblings=(kind==='part'?story.parts:kind==='chapter'?story.chapters.filter((item)=>item.partId===currentParent):chapter?.scenes??[]).filter((item)=>!item.trashedAt).sort((a,b)=>a.order-b.order)
    const index=siblings.findIndex((item)=>item.id===unit.id)
    const next=siblings[index+1]
    const parentOptions=(forKind:StoryStructureKind)=>(forKind==='part'?[]:forKind==='chapter'?[{value:'',label:copy('ungrouped')},...story.parts.filter((part)=>!ownReadOnly(part)).map((part)=>({value:part.id,label:part.title}))]:story.chapters.filter((chapter)=>!ownReadOnly(chapter)).map((chapter)=>({value:chapter.id,label:chapter.title})))
    const moveParent=container||((kind==='scene')?currentParent??'':'')
    const destinationSiblings=(kind==='part'?story.parts:kind==='chapter'?story.chapters.filter((chapter)=>chapter.partId===(moveParent||null)):story.chapters.find((chapter)=>chapter.id===moveParent)?.scenes??[]).filter((item)=>!item.trashedAt&&item.id!==unit.id).sort((a,b)=>a.order-b.order)
    const needsRestoreParent=kind==='chapter'||kind==='scene'
    const restoreOptions=kind==='chapter'||kind==='scene'?parentOptions(kind):[]
    const originalRestoreParent=restoreOptions.some((option)=>option.value===(currentParent??''))?currentParent??'':null
    const restoreParent=restoreSelection?.unit===kind+':'+unit.id?restoreSelection.parentId:originalRestoreParent
    const restoreValid=!needsRestoreParent||restoreParent!==null&&restoreOptions.some((option)=>option.value===restoreParent)
    const creationKey=kind+':'+unit.id+':'+createKind
    const defaultCreateParent=createKind==='part'?null:createKind==='chapter'?(kind==='part'?unit.id:chapter?.partId??null):(kind==='chapter'?unit.id:kind==='scene'?currentParent:null)
    const createParent=creation?.key===creationKey?creation.parentId:defaultCreateParent
    const createPosition=creation?.key===creationKey?creation.position:'end'
    const createParents=parentOptions(createKind)
    const createParentValid=createKind==='part'||createParents.some((option)=>option.value===(createParent??''))
    const sourcePart=kind==='part'?unit:story.parts.find((part)=>part.id===chapter?.partId)
    const createAnchor=createKind==='part'?sourcePart:createKind==='chapter'?chapter:kind==='scene'?unit:undefined
    const anchorParent=createKind==='part'?null:createKind==='chapter'?(createAnchor as StoryChapterOutline|undefined)?.partId:(createAnchor as StorySceneOutline|undefined)?.chapterId
    const relativeCreate=Boolean(createAnchor&&!createAnchor.trashedAt&&anchorParent===(createParent??null)&&createParentValid)
    const createPositionValid=createPosition==='end'||relativeCreate
    const changeCreation=(parentId:string|null,position:'end'|'before'|'after'='end')=>setCreation({key:creationKey,parentId,position})
    function destination(operation:StoryStructureOperation){
        if(!['create','move','restore'].includes(operation.op)||!('kind' in operation)||!('parentId' in operation))return undefined
        const parent=operation.kind==='part'?story.title:parentOptions(operation.kind).find((option)=>option.value===(operation.parentId??''))?.label
        if(!parent)return undefined
        const before='beforeId' in operation&&operation.beforeId?all.find(({unit})=>unit.id===operation.beforeId)?.unit.title:null
        const after='afterId' in operation&&operation.afterId?all.find(({unit})=>unit.id===operation.afterId)?.unit.title:null
        return copy('destinationValue',{container:parent,position:before?copy('beforeTitle',{title:before}):after?copy('afterTitle',{title:after}):copy('end')})
    }
    function review(operation:StoryStructureOperation,label:string,help?:string,affected=scenes) {setError(null);setPreview({source:story,operation,label,help,scenes:affected,destination:destination(operation)})}
    function lifecycle(action:'archive'|'trash'|'restore') {
        if(action==='restore'&&!restoreValid){setError(copy('restoreParentRequired'));return}
        if(kind==='novel')setPreview({source:story,rootAction:action,label:copy(action),help:copy('lifecycleHelp'),scenes})
        else review({op:action,kind,id:unit.id,...(action==='restore'&&needsRestoreParent?{parentId:restoreParent||null}:{})},copy(action),copy('lifecycleHelp'))
    }
    async function apply() {
        if(!preview||readOnly||applying.current)return
        applying.current=true;setPending(true);setError(null)
        try {
            if(!await beforeWrite()||!isCurrent()||!workspace.isCurrent())return
            if(isStudioSource(preview.source)&&!pendingOperation){
                const latest=await refreshStory(story.id)
                if(!isCurrent()||!workspace.isCurrent())return
                if(studioReviewVersion(latest)!==studioReviewVersion(preview.source)){
                    setPreview(null);setError(t('novelEditor.loading.reviewChanged'));return
                }
            }
            if(preview.operation) {
                const result=await operate(preview.operation)
                if(!result){setError(copy('failed'));return}
            } else if(preview.rootAction) await storyLifecycle(story.id,preview.rootAction)
            setPreview(null)
            // A lifecycle or split can make the selected item disappear from the active outline.
            if(preview.rootAction==='trash')onClose()
        } catch {setError(copy('failed'))} finally {applying.current=false;setPending(false)}
    }
    function reorder(direction:-1|1) {
        const swap=index+direction
        if(kind==='novel'||swap<0||swap>=siblings.length)return
        const ids=siblings.map((item)=>item.id);[ids[index],ids[swap]]=[ids[swap],ids[index]]
        review({op:'reorder',kind,parentId:currentParent,ids},copy(direction===-1?'up':'down'))
    }
    return <>
        <Drawer open onClose={onClose} title={copy('manage')} size="lg">
            <div className="space-y-6">
                <Field label={copy('select')}><Select value={kind+':'+unit.id} onChange={(value)=>{
                    const item=all.find((item)=>item.kind+':'+item.unit.id===value)
                    if(item){onSelect({kind:item.kind,id:item.unit.id});setContainer('');setBeforeId('');setError(null)}
                }} options={all.map(({kind,unit})=>({value:kind+':'+unit.id,label:copy('scopes.'+kind)+' · '+unit.title+(unit.trashedAt?' · '+copy('trashTitle'):unit.status==='archived'?' · '+copy('statuses.archived'):'')}))}/></Field>
                {error&&<Callout tone="warning" role="alert">{error}</Callout>}
                <section className="space-y-4"><h2 className="font-display text-h3 text-parchment-100">{copy('details')}</h2>
                    <NovelUnitDetails key={kind+unit.id} story={story} workspace={workspace} kind={kind} unit={unit} readOnly={disabled} beforeWrite={beforeWrite}/>
                    {kind==='novel'&&story.copiedFrom&&<NovelCopyOrigin key={story.id} story={story}/>}
                    {kind==='novel'&&!story.copiedFrom&&<NovelCreationOrigin key={story.id} story={story} workspace={workspace}/>}
                </section>
                <section className="space-y-4 border-t border-line pt-5"><h2 className="font-display text-h3 text-parchment-100">{copy('actions')}</h2>
                    <p className="text-caption text-parchment-400">{affected(scenes)}</p>
                    {kind==='scene'&&<Field label={copy('splitTitle')}><Input value={title} maxLength={255} disabled={disabled} onChange={(event)=>setTitle(event.target.value)}/></Field>}
                    <div className="flex flex-wrap gap-2">
                        {kind==='novel'&&onCopyNovel&&<Button variant="secondary" size="sm" disabled={readOnly||busy||pending} onClick={onCopyNovel}>{t('novelEditor.copyNovel.title')}</Button>}
                        {kind!=='novel'&&<><Button variant="secondary" size="sm" disabled={disabled||index<=0} onClick={()=>reorder(-1)}>{copy('up')}</Button>
                            <Button variant="secondary" size="sm" disabled={disabled||index<0||index>=siblings.length-1} onClick={()=>reorder(1)}>{copy('down')}</Button></>}
                        {(kind==='chapter'||kind==='scene')&&<Button size="sm" variant="secondary" disabled={disabled} onClick={()=>{clearOperationError?.();setCopyTarget({kind,id:unit.id,title:unit.title})}}>{copy('copy')}</Button>}
                        {kind==='scene'&&<Button size="sm" variant="secondary" disabled={disabled||unit.id!==activeSceneId||!title.trim()} onClick={()=>{
                            const cursor=splitCursor()
                            if(!cursor){setError(copy('cursorRequired'));return}
                            review({op:'split_scene',id:unit.id,...cursor,expectedRevision:(unit as StorySceneOutline).revision,title:title.trim()},copy('split'),copy('splitHelp'))
                        }}>{copy('split')}</Button>}
                        {kind==='scene'&&chapter&&chapter.scenes.filter((scene)=>!scene.trashedAt).sort((a,b)=>a.order-b.order)[0]?.id!==unit.id&&<Button size="sm" variant="secondary" disabled={disabled||!title.trim()} onClick={()=>review({op:'split_chapter',id:chapter!.id,beforeSceneId:unit.id,title:title.trim()},copy('splitChapter'),copy('splitHelp'))}>{copy('splitChapter')}</Button>}
                        {(kind==='chapter'||kind==='scene')&&next&&<Button size="sm" variant="secondary" disabled={disabled||ownReadOnly(next)} onClick={()=>review(kind==='scene'?{op:'merge_scenes',id:unit.id,withId:next.id,expectedRevision:(unit as StorySceneOutline).revision,otherExpectedRevision:(next as StorySceneOutline).revision,sceneBreak}:{op:'merge_chapters',id:unit.id,withId:next.id},copy('merge'),copy('mergeHelp'),[...scenes,...(kind==='scene'?[next as StorySceneOutline]:(next as StoryChapterOutline).scenes)])}>{copy('merge')}</Button>}
                    </div>
                    {kind==='scene'&&<SwitchRow checked={sceneBreak} onChange={setSceneBreak} label={copy('sceneBreak')}/>}
                    {kind!=='novel'&&kind!=='part'&&<div className="space-y-3">
                        <Field label={copy('parent')}><Select value={moveParent} onChange={(value)=>{setContainer(value);setBeforeId('')}} options={parentOptions(kind)} disabled={disabled}/></Field>
                        <Field label={copy('before')}><Select value={beforeId} onChange={setBeforeId} disabled={disabled} options={[{value:'',label:copy('end')},...destinationSiblings.map((item)=>({value:item.id,label:item.title}))]}/></Field>
                        <Button variant="secondary" size="sm" disabled={disabled||kind==='scene'&&!moveParent} onClick={()=>review({op:'move',kind,id:unit.id,parentId:moveParent||null,...(beforeId?{beforeId}:{})},copy('move'))}>{copy('move')}</Button>
                    </div>}
                    {(unit.trashedAt||unit.status==='archived')&&needsRestoreParent&&<Field label={copy('restoreParent')} helper={copy('restoreParentHelp')}><Select
                        value={restoreParent??'__choose_restore__'} onChange={(value)=>setRestoreSelection({unit:kind+':'+unit.id,parentId:value})}
                        options={[{value:'__choose_restore__',label:copy('restoreParentRequired'),disabled:true},...restoreOptions]}
                        disabled={readOnly||rootReadOnly||busy||pending}/></Field>}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" disabled={disabled} onClick={()=>lifecycle('archive')}>{copy('archive')}</Button>
                        <Button variant="secondary" size="sm" disabled={disabled} onClick={()=>lifecycle('trash')}>{copy('trash')}</Button>
                        {(unit.trashedAt||unit.status==='archived')&&<Button size="sm" disabled={readOnly||busy||pending||kind!=='novel'&&rootReadOnly||!restoreValid} onClick={()=>lifecycle('restore')}>{copy('restore')}</Button>}
                    </div>
                </section>
                <section className="space-y-4 border-t border-line pt-5"><h2 className="font-display text-h3 text-parchment-100">{copy('create')}</h2>
                    <Field label={copy('newItemTitle')}><Input value={createTitle} maxLength={255} disabled={readOnly||rootReadOnly||busy} onChange={(event)=>setCreateTitle(event.target.value)}/></Field>
                    <Field label={copy('kind')}><Select value={createKind} onChange={(value)=>{setCreateKind(value as StoryStructureKind);setContainer('')}} options={(['part','chapter','scene'] as const).map((value)=>({value,label:copy('scopes.'+value)}))} disabled={readOnly||rootReadOnly||busy}/></Field>
                    {createKind!=='part'&&<Field label={copy('createParent')}><Select value={createParentValid?createParent??'':'__choose_create__'} onChange={(value)=>changeCreation(value||null)} options={[{value:'__choose_create__',label:copy('chooseContainer'),disabled:true},...createParents]} disabled={readOnly||rootReadOnly||busy}/></Field>}
                    <Field label={copy('insertionPosition')} helper={copy('insertionHelp')}><Select value={createPositionValid?createPosition:'__choose_position__'} onChange={(value)=>changeCreation(createParent,value as 'end'|'before'|'after')}
                        options={[{value:'__choose_position__',label:copy('choosePosition'),disabled:true},{value:'end',label:copy('end')},...(relativeCreate?[{value:'before',label:copy('beforeTitle',{title:createAnchor!.title})},{value:'after',label:copy('afterTitle',{title:createAnchor!.title})}]:[])]} disabled={readOnly||rootReadOnly||busy}/></Field>
                    <Button size="sm" disabled={readOnly||rootReadOnly||busy||!createTitle.trim()||!createParentValid||!createPositionValid} onClick={()=>review({op:'create',kind:createKind,title:createTitle.trim(),parentId:createKind==='part'?null:createParent,...(createPosition==='before'?{beforeId:createAnchor!.id}:createPosition==='after'?{afterId:createAnchor!.id}:{})},copy('create'),undefined,[])}>{copy('create')}</Button>
                </section>
                <section className="space-y-3 border-t border-line pt-5"><h2 className="font-display text-h3 text-parchment-100">{copy('trashTitle')}</h2><p className="text-caption text-parchment-400">{copy('trashHelp')}</p>
                    {all.filter(({kind,unit})=>kind!=='novel'&&(unit.trashedAt||unit.status==='archived')).map(({kind,unit})=><Button key={kind+unit.id} size="sm" variant="ghost" onClick={()=>onSelect({kind,id:unit.id})}>{copy('scopes.'+kind)+' · '+unit.title}</Button>)}
                </section>
                <section className="space-y-3 border-t border-line pt-5">
                    <Button size="sm" variant="secondary" onClick={()=>setHistoryOpen((value)=>!value)} aria-expanded={historyOpen}>{t('novelEditor.structureHistory.open')}</Button>
                    {historyOpen&&<NovelStructureHistory source={historySource} structureRevision={story.structureRevision} readOnly={readOnly||rootReadOnly} busy={busy||pending} pendingOperation={pendingOperation} operationError={operationError} clearOperationError={clearOperationError} beforeWrite={beforeWrite} operate={operate}/>}
                </section>
            </div>
        </Drawer>
        {copyTarget&&!readOnly&&!rootReadOnly&&<NovelUnitCopyModal key={story.id+':'+copyTarget.kind+':'+copyTarget.id} source={copyTarget} busy={busy} pendingOperation={pendingOperation} operationError={operationError} clearError={clearOperationError}
            loadSource={async()=>{if(!await beforeWrite()||!isCurrent())return null;const saved=await refreshStory(story.id);return isCurrent()?saved:null}}
            loadAnnotations={async()=>{const api=isCurrent()?workspace.detachedApi():null;if(!api)return null;const value=await api.getStoryAnnotationCopyPreview(story.id);return isCurrent()?value:null}}
            loadBookmarks={async()=>{const api=isCurrent()?workspace.detachedApi():null;if(!api)return null;const value=await api.getStoryAnnotationCopyPreview(story.id,'bookmark');return isCurrent()?value:null}}
            beforeWrite={beforeWrite} operate={operate} readExcerpts={readExcerpts} onClose={()=>setCopyTarget(null)}/>}
        <Modal open={Boolean(preview)} onClose={()=>{if(!pending)setPreview(null)}} title={copy('preview')} size="lg" footer={<><Button variant="secondary" disabled={pending} onClick={()=>setPreview(null)}>{t('common.cancel')}</Button><Button disabled={readOnly||pending||busy||Boolean(preview?.scenes.length&&!preview.scenes.every(loadedStoryScene)&&!excerptsReady&&!pendingOperation)} onClick={()=>void apply()}>{copy('apply')}</Button></>}>
            <div className="space-y-4"><p>{copy('previewOperation',{action:preview?.label})}</p><p className="text-body text-parchment-200">{preview?.help??copy('previewHelp')}</p>
                {preview?.operation&&'title' in preview.operation&&preview.operation.title&&<p className="text-body text-parchment-100">{copy('newTitleReview',{title:preview.operation.title})}</p>}
                {preview?.destination&&<p className="text-body text-parchment-100">{copy('destination',{value:preview.destination})}</p>}
                <p>{affected(preview?.scenes??[])}</p>
                {preview&&<NovelSceneExcerpts source={preview.source} scenes={preview.scenes} read={readExcerpts} onReady={setExcerptsReady}/>}
                {error&&<Callout tone="warning" role="alert">{error}</Callout>}
            </div>
        </Modal>
    </>
}
