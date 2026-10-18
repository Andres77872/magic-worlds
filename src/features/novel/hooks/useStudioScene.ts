import { sceneForStudioUnit } from '@/shared/storyStudioSelection'
import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import { verifyStoryStudioScene } from '@/infrastructure/api/storyStudioContract'
import type { StoryOutline,StorySceneOutline,StorySceneDocument,StorySceneHeader,StoryStudioScene } from '@/shared'
import { loadedStoryScene,isStudioSource,sceneReferences,mergeStudioDocument,studioInheritance } from '@/shared/storyStudioState'
import { StudioSceneCache } from '../persistence/studioSceneCache'
import type { StoryWorkspace } from './useStoryWorkspace'
import { useStudioReadStorage } from './useStudioReadStorage'
import { deviceCacheScope, matchingCachedScene, studioReadStorage, type CachedSceneRead } from '../persistence/studioReadStorage'
import { browserCanConnect } from './useBrowserConnectivity'

export interface SceneConfirmation {scene:StorySceneDocument;generationId?:string;sequence:number;read?:StoryStudioScene;select?:boolean}
interface Options {
    story:StoryOutline|null
    requested:StorySceneOutline|null
    unitId:string|null
    workspace:StoryWorkspace
    confirmation?:SceneConfirmation|null
    onSelect:(id:string)=>void
}
/** The active canonical seed and a bounded disposable confirmed-read cache. */
export function useStudioScene({story,requested,unitId,workspace,confirmation,onSelect}:Options){
    const {userHash,accountKey}=useAuth(),{refreshStory,consumeSceneConfirmation}=useData()
    const { remember: rememberDurable, status: deviceCacheStatus } = useStudioReadStorage(story, workspace, confirmation)
    const scope=JSON.stringify([apiStorageOrigin(API_BASE_URL),userHash,accountKey,workspace.workspaceId,story?.id??null])
    const readable=workspace.isCurrent()
    const ownerCache=useMemo(()=>({scope,cache:new StudioSceneCache()}),[scope])
    const [seed,setSeed]=useState<{scope:string;scene:StorySceneDocument|null}>(()=>{
        const read=confirmation?.read
        const scene=loadedStoryScene(requested)?requested:read&&story&&isStudioSource(story)&&requested&&verifyStoryStudioScene(read,story,requested as StorySceneHeader)?read.scene:null
        return {scope,scene}
    })
    const [status,setStatus]=useState<{scope:string;loading:boolean;error:'failed'|'changed'|'inputChanged'|null;unitId:string|null}>({scope,loading:false,error:null,unitId:null})
    const current=useRef({scope,story,workspace,onSelect,requested,unitId,seed,confirmation})
    useLayoutEffect(()=>{current.current={scope,story,workspace,onSelect,requested,unitId,seed,confirmation}})
    const mounted=useRef(true),serial=useRef(0),flight=useRef<AbortController|null>(null)
    const commitGuard=useRef<(()=>boolean)|null>(null)
    const setSelectionGuard=useCallback((guard:(()=>boolean)|null)=>{commitGuard.current=guard},[])
    // Hosts call this when the guard may have opened, so a deferred refresh can run.
    const [guardTick,setGuardTick]=useState(0)
    const recheckSelection=useCallback(()=>setGuardTick((tick)=>tick+1),[])
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;flight.current?.abort();ownerCache.cache.clear()}},[ownerCache])

    const visible=useMemo<StorySceneDocument|null>(()=>{
        if(seed.scope!==scope||!readable||!story||!requested)return null
        let scene=seed.scene
        if(!scene)return null
        if(confirmation?.scene.storyId===story.id&&confirmation.scene.id===scene.id){
            scene=mergeStudioDocument(confirmation.scene,scene)
        }
        const chapter=story.chapters.find((chapter)=>chapter.scenes.some((head)=>head.id===scene!.id))
        const head=chapter?.scenes.find((head)=>head.id===scene!.id)
        if(!chapter||!head)return {...scene,inheritance:{values:scene.inheritance?.values??{includeInAI:true,includeInExport:true},origins:scene.inheritance?.origins??{},readOnly:true}}
        const metadata=head.metadataRevision>=scene.metadataRevision?head:scene
        return {...scene,title:metadata.title,status:metadata.status,wordGoal:metadata.wordGoal,details:metadata.details,
            povCardId:metadata.povCardId,locationCardId:metadata.locationCardId,metadataRevision:metadata.metadataRevision,
            chapterId:chapter.id,order:head.order,trashedAt:head.trashedAt,inheritance:head.inheritance??studioInheritance(story,chapter,head),
            statistics:head.revision===scene.revision&&head.contentHash===scene.contentHash?head.statistics:scene.statistics,
            activeCardRefs:sceneReferences(story,{id:scene.id,chapterId:chapter.id})}
    },[seed,scope,readable,story,confirmation,requested])
    const visibleRef=useRef(visible)
    useLayoutEffect(()=>{visibleRef.current=visible},[visible])

    const consumed=useRef<string|null>(null)
    useEffect(()=>{
        if(!confirmation||!visible||seed.scope!==scope||confirmation.scene.id!==visible.id||consumed.current===scope+':'+confirmation.sequence)return
        consumed.current=scope+':'+confirmation.sequence
        const read=confirmation.read,head=story?.chapters.flatMap((chapter)=>chapter.scenes).find((head)=>head.id===visible.id)
        if(read&&story&&isStudioSource(story)&&head)ownerCache.cache.put(story,head as StorySceneHeader,read)
        setSeed({scope,scene:visible});consumeSceneConfirmation?.(confirmation.sequence)
    },[confirmation,visible,seed.scope,scope,story,ownerCache,consumeSceneConfirmation])

    const select=useCallback(async(id:string,sourceOverride?:StoryOutline,signal?:AbortSignal):Promise<boolean>=>{
        const owner=current.current,source=sourceOverride??owner.story
        if(signal?.aborted||owner.scope!==ownerCache.scope||!source||source.id!==owner.story?.id||!owner.workspace.isCurrent())return false
        const target=sceneForStudioUnit(source,id)
        if(!target.found)return false
        const ticket=++serial.current
        flight.current?.abort();const abort=new AbortController();flight.current=abort
        const cancel=()=>{
            abort.abort()
            if(mounted.current&&serial.current===ticket&&current.current.scope===owner.scope){
                setStatus({scope:owner.scope,loading:false,error:null,unitId:null})
            }
        }
        signal?.addEventListener('abort',cancel,{once:true})
        setStatus({scope:owner.scope,loading:true,error:null,unitId:id})
        const live=()=>mounted.current&&!abort.signal.aborted&&serial.current===ticket&&current.current.scope===owner.scope&&owner.workspace.isCurrent()
        try{
            let scene:StorySceneDocument|null=null
            if(target.scene){
                if(loadedStoryScene(target.scene))scene=target.scene
                else{
                    if(!isStudioSource(source))throw new Error('This scene has no verified source')
                    const head=target.scene as StorySceneHeader
                    const preloaded=owner.confirmation?.read
                    let read=preloaded&&verifyStoryStudioScene(preloaded,source,head)?preloaded:ownerCache.cache.get(source,head)
                    let copy: CachedSceneRead | undefined
                    if(!read){
                        if (!browserCanConnect() && userHash && workspace.workspaceId) {
                            const copies = await studioReadStorage.list(deviceCacheScope(userHash))
                            if (!live()) return false
                            copy = copies.items.find((item) => item.workspace.id === workspace.workspaceId && item.index.id === source.id)?.scenes[head.id]
                            if (copy?.read.projection === 'studio_scene' && verifyStoryStudioScene(copy.read, source, head)) read = copy.read
                            else if (copy) scene = matchingCachedScene(copy, source, head)
                            if (!read && !scene) throw new Error('This scene is not available on this device')
                        }
                    }
                    if(!read && !scene){
                        const api=owner.workspace.detachedApi()
                        if(!api)throw new Error('The novel account is unavailable')
                        read=await api.getStoryStudioScene(source,head,{signal:abort.signal})
                    }
                    if(!live())return false
                    const latest=current.current.story
                    const latestHead=latest?.chapters.flatMap((chapter)=>chapter.scenes).find((item)=>item.id===head.id)
                    if(!latest||!isStudioSource(latest)||!latestHead || (read ? !verifyStoryStudioScene(read,latest,latestHead as StorySceneHeader)
                        : !copy || !matchingCachedScene(copy,latest,latestHead as StorySceneHeader))) throw new ApiError(409,'The saved outline changed.',{code:'STORY_STUDIO_SOURCE_CHANGED'})
                    if (read) {
                        ownerCache.cache.put(latest,latestHead as StorySceneHeader,read)
                        rememberDurable(latest, read)
                        scene=read.scene
                    }
                }
            }
            if(!live())return false
            if(visibleRef.current&&commitGuard.current&&!commitGuard.current()){
                // A newer copy of the visible scene waits for the writer instead of
                // reporting a conflict; recheckSelection() runs the refresh again.
                const refresh=target.scene?.id===visibleRef.current.id
                setStatus({scope:owner.scope,loading:false,error:refresh?null:'inputChanged',unitId:refresh?null:id});return false
            }
            // The previous writer remains mounted until this verified seed is ready.
            setSeed({scope:owner.scope,scene});owner.onSelect(id)
            setStatus({scope:owner.scope,loading:false,error:null,unitId:null})
            return true
        }catch(error){
            if(live()&&!abort.signal.aborted)setStatus({scope:owner.scope,loading:false,error:error instanceof ApiError&&error.code==='STORY_STUDIO_SOURCE_CHANGED'?'changed':'failed',unitId:id})
            return false
        }finally{signal?.removeEventListener('abort',cancel);if(flight.current===abort)flight.current=null}
    },[ownerCache, rememberDurable, userHash, workspace.workspaceId])

    useEffect(()=>{
        if(!story||!workspace.isCurrent()||status.scope===scope&&(status.loading||status.error))return
        if(!requested)return
        if(visible?.id===requested.id&&(visible.revision>requested.revision||visible.revision===requested.revision&&visible.contentHash===requested.contentHash))return
        if(visible?.id===requested.id&&commitGuard.current&&!commitGuard.current())return
        void select(unitId&&sceneForStudioUnit(story,unitId).found?unitId:requested.id)
    },[story,workspace,requested,scope,status,seed,visible,select,unitId,guardTick])
    const retry=useCallback(async()=>{
        const owner=current.current,id=status.scope===scope?status.unitId:null
        if(owner.scope!==scope||!owner.story||!owner.workspace.isCurrent())return false
        try{
            const fresh=await refreshStory(owner.story.id)
            if(current.current.scope!==owner.scope||!owner.workspace.isCurrent())return false
            return select(id??owner.unitId??owner.requested?.id??'',fresh)
        }catch{if(current.current.scope===owner.scope)setStatus({scope:owner.scope,loading:false,error:'failed',unitId:id});return false}
    },[refreshStory,scope,select,status])
    return {scene:visible,select,retry,setSelectionGuard,recheckSelection,loading:status.scope===scope&&status.loading,
        error:status.scope===scope?status.error:null,pendingUnitId:status.scope===scope?status.unitId:null,cacheSize:ownerCache.cache.size,deviceCacheStatus}
}
