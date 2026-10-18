import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { ApiError } from '@/infrastructure/api'
import type { StoryReadingPage,StoryReadingRequest } from '@/shared/types/storyReading.types'
import type { ManuscriptReadingSource } from './useManuscriptReadingSource'
import { verifyReadingPage } from '@/infrastructure/api/storyReadingContract'

export type ReadingScope=Required<Pick<StoryReadingRequest,'scope'|'unitId'|'includeArchived'>>
export const DEFAULT_MANUSCRIPT_SCOPE:ReadingScope=Object.freeze({scope:'novel',unitId:null,includeArchived:false})
export function isManuscriptReadingScope(value:unknown):value is ReadingScope {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const v=value as Record<string,unknown>
    return Object.keys(v).length===3&&['novel','part','chapter','scene'].includes(String(v.scope))&&typeof v.includeArchived==='boolean'
        &&(v.scope==='novel'?v.unitId===null:typeof v.unitId==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v.unitId))
}
export const MAX_READER_PAGES=3
interface State {owner:object;pages:StoryReadingPage[];busy:boolean;error:'changed'|'failed'|'positionUnavailable'|null}
export function useManuscriptReading(source:ManuscriptReadingSource,options:ReadingScope,initialSceneId:string|null=null,beforePageChange?:(fallbackSceneId?:string)=>void,visibleSceneId?:()=>string|null){
    const key=source.key+JSON.stringify(options)
    const [restart,setRestart]=useState({key,start:initialSceneId,serial:0})
    const start=restart.key===key?restart.start:initialSceneId,serial=restart.key===key?restart.serial:0
    const owner=useMemo(()=>({source,key,start,serial}),[source,key,start,serial])
    const [state,setState]=useState<State>({owner,pages:[],busy:true,error:null})
    const active=useRef<object|null>(owner),flights=useRef(new Set<object>()),latest=useRef(state),before=useRef(beforePageChange),visible=useRef(visibleSceneId)
    useLayoutEffect(()=>{active.current=owner;return()=>{active.current=null}},[owner])
    useLayoutEffect(()=>{latest.current=state;before.current=beforePageChange;visible.current=visibleSceneId},[state,beforePageChange,visibleSceneId])
    const load=useCallback(async(direction:'first'|'next'|'previous',automatic=false)=>{
        const previous=latest.current
        if(active.current!==owner||!source.isCurrent()||flights.current.has(owner)||direction!=='first'&&(previous.owner!==owner||previous.error==='changed'||previous.error==='positionUnavailable'))return
        const pages=direction==='first'?[]:previous.pages,last=pages[pages.length-1],head=pages[0]
        const cursor=direction==='next'?last?.nextAfterSceneId:head?.navigation?.previousBeforeSceneId
        if(direction!=='first'&&!cursor)return
        const canEvict=()=>{
            if(!automatic||pages.length<MAX_READER_PAGES)return true
            const sceneId=visible.current?.(),evicted=direction==='next'?pages[0]:pages[pages.length-1]
            return Boolean(sceneId&&!evicted.items.some((item)=>item.header.sceneId===sceneId))
        }
        if(!canEvict())return
        flights.current.add(owner)
        const current=()=>active.current===owner&&source.isCurrent()
        setState({owner,pages,busy:true,error:null})
        const query:StoryReadingRequest={...options,windowed:true,limit:2,...(direction==='first'?(start?{startSceneId:start}:{}):
            {sourceSnapshot:head.sourceSnapshot,...(direction==='next'?{afterSceneId:cursor}:{beforeSceneId:cursor})})}
        try{
            const page=await source.read(query)
            if(!current())return
            if(!verifyReadingPage(page,source.storyId,query)||direction==='next'&&page.offset!==last.offset+last.items.length
                ||direction==='previous'&&page.offset+page.items.length!==head.offset||head&&(
                    page.sourceSnapshot!==head.sourceSnapshot||page.sourceStructureRevision!==head.sourceStructureRevision||page.sourceMetadataRevision!==head.sourceMetadataRevision||page.sourceContextRevision!==head.sourceContextRevision
                    ||page.totalScenes!==head.totalScenes||page.items.some((item)=>pages.some((p)=>p.items.some((old)=>old.header.sceneId===item.header.sceneId)))))throw new Error('Mismatched manuscript window')
            // A user can scroll back while the read is in flight. Automatic
            // paging must never evict the passage now visible at the top.
            if(!canEvict()){setState({owner,pages,busy:false,error:null});return}
            if(direction!=='first')before.current?.(page.items[0]?.header.sceneId)
            const combined=direction==='previous'?[page,...pages]:[...pages,page]
            setState({owner,pages:direction==='previous'?combined.slice(0,MAX_READER_PAGES):combined.slice(-MAX_READER_PAGES),busy:false,error:null})
        }catch(error){
            if(current())setState({owner,pages,busy:false,error:error instanceof ApiError&&error.status===409?'changed':error instanceof ApiError&&['STORY_READING_POSITION_INVALID','STORY_READING_UNIT_NOT_FOUND'].includes(error.code??'')?'positionUnavailable':'failed'})
        }finally{flights.current.delete(owner)}
    },[owner,source,options,start])
    useEffect(()=>{void load('first')},[load])
    const value=state.owner===owner?state:{owner,pages:[],busy:true,error:null}
    const seek=(sceneId:string|null)=>{
        if(active.current!==owner||!source.isCurrent())return
        setRestart((old)=>({key,start:sceneId,serial:old.serial+1}))
    }
    return {...value,key,loadMore:(automatic=false)=>void load('next',automatic),loadPrevious:(automatic=false)=>void load('previous',automatic),seek,
        refresh:()=>seek(value.pages[0]?.items[0]?.header.sceneId??start),beginning:()=>seek(null)}
}
