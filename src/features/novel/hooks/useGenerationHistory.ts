import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import type { StoryOutline,StorySceneDocument,StoryGeneration,StoryGenerationStatus,StoryGenerationSummary,StoryGenerationHistoryPage } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'
import { isStudioSource } from '@/shared/storyStudioState'
import type { GenerationHistorySource } from './useGenerationHistorySource'

export interface HistoryGeneration extends StoryGeneration {chapterTitle:string;prompt?:string;location?:StoryGenerationSummary['location'];refinementSource?:import('@/shared/types/storyAssistant.types').NovelRefinementReference}
export type HistoryGenerationRow=HistoryGeneration|(StoryGenerationSummary&{prompt?:undefined})
const OUTPUT_CACHE_BYTES=16*1024*1024
function boundedOutputs(items:HistoryGeneration[]):HistoryGeneration[]{
    let bytes=0
    return items.slice(0,10).filter((item)=>{
        const size=new TextEncoder().encode(JSON.stringify(item)).byteLength
        if(bytes+size>OUTPUT_CACHE_BYTES)return false
        bytes+=size;return true
    })
}
interface Options {story:StoryOutline|null;scene?:StorySceneDocument|null;source?:GenerationHistorySource|null;open?:boolean}

/** Paged summaries plus a small cache of confirmed results from this session. */
export function useGenerationHistory({story,scene,source=null,open=false}:Options){
    const storyId=story?.id??null,scope=source?.key??'local:'+storyId
    const [local,setLocal]=useState<{scope:string;items:HistoryGeneration[]}>({scope,items:[]})
    const [patches,setPatches]=useState<{scope:string;values:Record<string,StoryGenerationStatus>}>({scope,values:{}})
    const [navigation,setNavigation]=useState<{scope:string;before:string|null;previous:Array<string|null>}>({scope,before:null,previous:[]})
    const before=navigation.scope===scope?navigation.before:null,previous=navigation.scope===scope?navigation.previous:[]
    const [page,setPage]=useState<{request:object|null;scope:string;before:string|null;value:StoryGenerationHistoryPage|null;loading:boolean;error:boolean}>({request:null,scope,before:null,value:null,loading:false,error:false})
    const [reload,setReload]=useState(0)
    const request=useMemo(()=>({scope,before,source,open,reload}),[scope,before,source,open,reload])
    const live=useRef({storyId,scope,source,scene})
    useLayoutEffect(()=>{live.current={storyId,scope,source,scene}})
    // Scope changes retire only confirmed read caches; durable writing lives elsewhere.
    if(local.scope!==scope)setLocal({scope,items:[]})
    if(patches.scope!==scope)setPatches({scope,values:{}})
    useEffect(()=>{
        const {open,source,scope,before}=request
        if(!open||!source||!source.isCurrent())return
        let current=true;const abort=new AbortController()
        void source.page(before,abort.signal).then((value)=>{
            if(current&&live.current.scope===scope&&source.isCurrent())setPage({request,scope,before,value,loading:false,error:false})
        }).catch(()=>{if(current&&!abort.signal.aborted&&live.current.scope===scope)setPage((old)=>({...old,request,scope,before,loading:false,error:true}))})
        return()=>{current=false;abort.abort()}
    },[request])
    const localItems=useMemo(()=>local.scope===scope?local.items:[],[local,scope])
    const status=useMemo(()=>patches.scope===scope?patches.values:{},[patches,scope])
    const pageValue=page.scope===scope&&page.before===before?page.value:null
    const generations=useMemo<HistoryGenerationRow[]>(()=>{
        const values=new Map<string,HistoryGenerationRow>()
        if(!source&&story&&!isStudioSource(story)){
            for(const chapter of chaptersFor(story)){
                if(!('generationHistory' in chapter)||!Array.isArray(chapter.generationHistory))continue
                for(const generation of chapter.generationHistory as StoryGeneration[])values.set(generation.id,{...generation,chapterTitle:chapter.title,prompt:generation.instruction??undefined})
            }
        }
        for(const generation of pageValue?.items??[])values.set(generation.id,generation)
        if(before===null)for(const generation of localItems){
            const saved=values.get(generation.id)
            values.set(generation.id,{...generation,...(saved&&'output' in saved?saved:{}),...(saved?{status:saved.status,appliedRevision:saved.appliedRevision}:{}),
                ...(saved?.location?{location:saved.location}:{}),prompt:saved&&'instruction' in saved?saved.instruction??generation.prompt:generation.prompt})
        }
        return [...values.values()].map((generation)=>({...generation,status:status[generation.id]??generation.status}))
            .sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')||(a.id<b.id?1:a.id>b.id?-1:0))
    },[source,story,pageValue,before,localItems,status])
    const record=useCallback((generation:StoryGeneration,chapterTitle:string,prompt?:string)=>{
        const owner=live.current
        if(owner.scope!==scope||generation.storyId!==owner.storyId||owner.source&&!owner.source.isCurrent())return
        setLocal((current)=>({scope:owner.scope,items:boundedOutputs([{...generation,chapterTitle,prompt:prompt?.trim()||undefined},
            ...(current.scope===owner.scope?current.items:[]).filter((item)=>item.id!==generation.id)])}))
    },[scope])
    const patchStatus=useCallback((id:string,status:StoryGenerationStatus)=>{
        const owner=live.current
        if(owner.scope!==scope||owner.source&&!owner.source.isCurrent())return
        setPatches((current)=>{
            const values={...(current.scope===owner.scope?current.values:{}),[id]:status}
            for(const key of Object.keys(values).slice(0,Math.max(0,Object.keys(values).length-100)))delete values[key]
            return {scope:owner.scope,values}
        })
    },[scope])
    const readGeneration=useCallback(async(row:HistoryGenerationRow,signal?:AbortSignal):Promise<HistoryGeneration|null>=>{
        const owner=live.current
        if(owner.scope!==scope||row.storyId!==owner.storyId||owner.source&&!owner.source.isCurrent())return null
        if('output' in row)return row
        if(!owner.source)return null
        const value=await owner.source.detail(row.id,signal)
        if(live.current.scope!==owner.scope||!owner.source.isCurrent())return null
        return {...value.generation,chapterTitle:value.chapterTitle+' · '+value.sceneTitle,prompt:value.generation.instruction??undefined,location:value.location,
            ...(value.refinementSource?{refinementSource:structuredClone(value.refinementSource)}:{})}
    },[scope])
    const traceFor=(id:string|undefined)=>{
        if(!id)return null
        return [...localItems,...(scene?.id===id&&'generationHistory' in scene&&Array.isArray(scene.generationHistory)?scene.generationHistory as StoryGeneration[]:[])]
            .filter((generation)=>generation.sceneId===id).sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''))[0]?.contextTrace??(scene?.id===id?scene.latestGenerationTrace??null:null)
    }
    const currentOwner=()=>live.current.scope===scope&&(!source||source.isCurrent())
    return {generations,record,patchStatus,readGeneration,traceFor,sourceKey:scope,
        loading:Boolean(source&&open&&(page.scope!==scope||page.before!==before||page.request!==request||page.loading||!pageValue&&!page.error)),
        error:Boolean(open&&(source?page.request===request&&page.scope===scope&&page.before===before&&page.error:story&&isStudioSource(story))),
        hasNext:Boolean(pageValue?.nextBefore),hasPrevious:previous.length>0,
        next:()=>{if(currentOwner()&&pageValue?.nextBefore)setNavigation({scope,before:pageValue.nextBefore,previous:[...previous,before]})},
        previous:()=>{if(currentOwner()&&previous.length)setNavigation({scope,before:previous[previous.length-1],previous:previous.slice(0,-1)})},
        refresh:()=>{if(!currentOwner())return;setNavigation({scope,before:null,previous:[]});setReload((value)=>value+1)}}
}
export type GenerationHistoryApi=ReturnType<typeof useGenerationHistory>
