import { useLayoutEffect,useMemo,useRef,useState,type ComponentProps } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import type { ApiService } from '@/infrastructure/api'
import type { StoryManuscriptDocument,StoryScene,StoryStudioSource,StoryStudioScene,StorySceneHeader } from '@/shared'
import { applyStudioSceneAcknowledgement } from '@/shared/storyStudioState'
import { documentMarkdown,documentText } from '@/shared/storyDocument'
import { Button,Callout } from '@/ui/primitives'
import { novel,storyChapter,storyScene,manuscript } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead,generationSummary,generationDetail } from '@/test/fixtures/storyStudio'
import { studioExcerptsRequest } from '@/infrastructure/api/storyStudioExcerptsContract'
import { useStudioScene,type SceneConfirmation } from '../hooks/useStudioScene'
import { useGenerationHistory } from '../hooks/useGenerationHistory'
import { NovelEditor } from '../editor/NovelEditor'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
import { NovelSceneExcerpts,type SceneExcerptReader } from './NovelSceneExcerpts'

const scenes=[storyScene({id:'loading-letter',title:'At the window',document:manuscript('The letter waited by the window. Mara recognized the seal.','loading-window')}),
    storyScene({id:'loading-arrival',title:'The visitor',order:1,document:manuscript('The visitor arrived before dawn. Someone had already opened the gate.','loading-gate')})]
const initial=studioIndex(novel({title:'The sealed letter',chapters:[storyChapter({scenes})]}))
const auth={userHash:'controlled-loading-author',accountKey:'controlled-loading-account'} as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue=NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
interface RoomProps {source:StoryStudioSource;confirmation:SceneConfirmation;api:ApiService;drafts:Record<string,StoryManuscriptDocument>;onDraft:(id:string,document:StoryManuscriptDocument)=>void;onSave:(scene:StoryScene,document:StoryManuscriptDocument)=>void}
function Room({source,confirmation,api,drafts,onDraft,onSave}:RoomProps){
    const [id,setId]=useState(scenes[0].id)
    const workspace=useMemo(()=>({workspaceId:'controlled-loading-workspace',isCurrent:()=>true,detachedApi:()=>api}),[api])
    const requested=source.chapters.flatMap(chapter=>chapter.scenes).find(scene=>scene.id===id)??null
    const load=useStudioScene({story:source,requested,unitId:id,workspace,confirmation,onSelect:setId})
    const dirty=Boolean(load.scene&&drafts[load.scene.id]),dirtyRef=useRef(dirty)
    useLayoutEffect(()=>{dirtyRef.current=dirty})
    const setSelectionGuard=load.setSelectionGuard
    useLayoutEffect(()=>{setSelectionGuard(()=>!dirtyRef.current);return()=>setSelectionGuard(null)},[setSelectionGuard])
    const scene=load.scene
    return <section className="space-y-4">
        <div className="flex flex-wrap gap-2">{scenes.map(scene=><Button key={scene.id} variant="secondary" onClick={()=>void load.select(scene.id)}>{'Open '+scene.title}</Button>)}</div>
        {load.loading&&<Callout tone="info">Loading the saved scene. Your current writing stays open.</Callout>}
        {load.error&&<Callout tone="warning">{load.error==='inputChanged'?'Your current writing changed. Save it, then retry.':'The saved scene is unavailable. Your current writing is retained.'}<Button variant="secondary" onClick={()=>void load.retry()}>Refresh and retry</Button></Callout>}
        {scene&&<><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-h3">{scene.title}</h2><span role="status">{dirty?'Unsaved writing':'Saved writing'}</span><Button disabled={!dirty} onClick={()=>onSave({...scene,generationHistory:[]},drafts[scene.id])}>Save current scene</Button></div>
            <NovelEditor key={scene.id} initialDocument={drafts[scene.id]??scene.document} codexEntries={[]} onDocumentChange={document=>onDraft(scene.id,document)} onRequestSaveFlush={async()=>!dirtyRef.current}
                onGenerate={async()=>{throw new Error('This fixture has no generation provider')}} onAcceptGeneration={async()=>{}} onDiscardGeneration={async()=>{}} onCritiqueResult={()=>{}}/>
        </>}
    </section>
}
function SceneLoadingDemo(){
    const [source,setSource]=useState<StoryStudioSource>(initial),[saved,setSaved]=useState<Record<string,StoryScene>>(()=>Object.fromEntries(scenes.map(scene=>[scene.id,scene])))
    const [drafts,setDrafts]=useState<Record<string,StoryManuscriptDocument>>({}),[confirmation,setConfirmation]=useState<SceneConfirmation>(()=>({sequence:1,scene:studioSceneRead(initial,scenes[0]).scene,read:studioSceneRead(initial,scenes[0])}))
    const [pending,setPending]=useState<{resolve:(value:StoryStudioScene)=>void;reject:(error:Error)=>void;source:StoryStudioSource;head:StorySceneHeader}|null>(null)
    const [reads,setReads]=useState(0)
    const api=useMemo(()=>({getStoryStudioScene:(source:StoryStudioSource,head:StorySceneHeader)=>{setReads(value=>value+1);return new Promise<StoryStudioScene>((resolve,reject)=>setPending({resolve,reject,source,head}))}}) as ApiService,[])
    const data={refreshStory:async()=>source} as unknown as DataValue
    function save(scene:StoryScene,document:StoryManuscriptDocument){
        const updated={...scene,document,plainText:documentText(document),body:documentMarkdown(document),revision:scene.revision+1,contentHash:String((scene.revision+1)%10).repeat(64)}
        setSaved(current=>({...current,[scene.id]:updated}));setSource(current=>applyStudioSceneAcknowledgement(current,updated));setConfirmation(current=>({sequence:current.sequence+1,scene:updated}))
        setDrafts(current=>{const next={...current};delete next[scene.id];return next})
    }
    return <AuthContext.Provider value={auth}><DataContext.Provider value={data}><FloatingWindowsProvider><div className="space-y-4 p-6">
        <h1 className="font-display text-h2">The sealed letter</h1>
        <div className="flex flex-wrap items-center gap-3"><span>Saved scene reads: {reads}</span><Button variant="secondary" disabled={!pending} onClick={()=>{if(pending){pending.resolve(studioSceneRead(pending.source,saved[pending.head.id]));setPending(null)}}}>Complete pending read</Button><Button variant="secondary" disabled={!pending} onClick={()=>{pending?.reject(new Error('Scene unavailable'));setPending(null)}}>Fail pending read</Button></div>
        <Room source={source} confirmation={confirmation} api={api} drafts={drafts} onDraft={(id,document)=>setDrafts(current=>({...current,[id]:document}))} onSave={save}/>
    </div></FloatingWindowsProvider></DataContext.Provider></AuthContext.Provider>
}
function HistoryDemo(){
    const [open,setOpen]=useState(true)
    const source=useMemo(()=>({key:'controlled-history',isCurrent:()=>true,page:async(before:string|null)=>({schemaVersion:1 as const,storyId:'story-1',before,items:[generationSummary({id:before?'generation-old':'generation-1',instructionPreview:'Continue beyond the old gate',outputPreview:before?'The lantern went out.':'The visitor waited.',outputTruncated:true,location:before?'trashed' as const:'active' as const})],nextBefore:before?null:'generation-1'}),detail:async(id:string)=>{const detail=generationDetail();return {...detail,generation:{...detail.generation,id}}}}),[])
    const history=useGenerationHistory({story:initial,source,open})
    return <><Button onClick={()=>setOpen(true)}>Open saved history</Button><NovelGenerationHistoryDrawer open={open} generations={history.generations} scopeKey={history.sourceKey} loading={history.loading} error={history.error} onClose={()=>setOpen(false)} onRead={history.readGeneration} hasNext={history.hasNext} hasPrevious={history.hasPrevious} onNext={history.next} onPrevious={history.previous} onRefresh={history.refresh}/></>
}
const excerptScenes=Array.from({length:26},(_,index)=>storyScene({id:'preview-'+index,title:'Passage '+(index+1),order:index}))
const excerptSource=studioIndex(novel({chapters:[storyChapter({scenes:excerptScenes})]}))
const readExcerpts:SceneExcerptReader=async(source,scenes)=>({schemaVersion:1,projection:'scene_excerpts',storyId:source.id,source:studioExcerptsRequest(source,scenes)!,items:scenes.map(scene=>({sceneId:scene.id,revision:scene.revision,metadataRevision:scene.metadataRevision,contentHash:scene.contentHash,text:'The gatekeeper remembers '+scene.title+'.',truncated:false}))})
function ExcerptsDemo(){return <NovelSceneExcerpts source={excerptSource} scenes={excerptSource.chapters[0].scenes} read={readExcerpts}/>}
const meta={title:'Novel/Studio loading',component:SceneLoadingDemo,tags:['autodocs'],parameters:{layout:'padded',docs:{description:{component:'Controlled scene reads around the real loader, bounded cache, and TipTap editor. Complete or fail a pending read, type while it waits, save and retry. History and organization previews use separate bounded projections. These fixtures make no project or provider requests.'}}}} satisfies Meta<typeof SceneLoadingDemo>
export default meta
type Story=StoryObj<typeof meta>
export const RetainedWriter:Story={}
export const PagedHistory:Story={render:()=> <HistoryDemo/>}
export const BoundedPreviews:Story={render:()=> <ExcerptsDemo/>}
