import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject } from 'react'
import type { StoryReadingPage } from '@/shared/types/storyReading.types'
import type { ManuscriptReadingSource } from './useManuscriptReadingSource'
import type { ReadingScope } from './useManuscriptReading'
import { captureReaderPosition,restoreReaderPosition,type ReaderPosition } from '../utils/readerPosition'

interface Options {
    source:ManuscriptReadingSource;scope:ReadingScope;preferenceKey?:string|null;appearance:string
    rootRef:RefObject<HTMLDivElement|null>;contentsRef:RefObject<HTMLDivElement|null>;pages:StoryReadingPage[];busy:boolean
    onEdge:(direction:'next'|'previous')=>void
    seed:{position:ReaderPosition|null;unavailable:boolean}
}
export function useReaderPosition({source,scope,preferenceKey,appearance,rootRef,contentsRef,pages,busy,onEdge,seed}:Options){
    const key=preferenceKey?preferenceKey+':reader-position':null
    const owner=useMemo(()=>({source,key,scope}),[source,key,scope])
    const [status,setStatus]=useState<{owner:object;unavailable:boolean;changed:boolean}>({owner,unavailable:seed.unavailable,changed:false})
    const active=useRef<object|null>(owner),live=useRef({pages,appearance,busy,onEdge})
    const resume=useRef<ReaderPosition|null>(seed.position),transient=useRef<ReaderPosition|null>(null),restored=useRef(false),blocked=useRef(false)
    const pending=useRef(new Map<string,ReaderPosition>()),timer=useRef<ReturnType<typeof setTimeout>|null>(null),frame=useRef<number|null>(null)
    const fallback=useRef<string|null>(null)
    const ignore=useRef(false),touched=useRef(false),lastTop=useRef(0)
    useLayoutEffect(()=>{
        active.current=owner;resume.current=seed.position;transient.current=null;fallback.current=null;restored.current=false;blocked.current=false;touched.current=false
        return()=>{active.current=null}
    },[owner,seed])
    useLayoutEffect(()=>{live.current={pages,appearance,busy,onEdge}},[pages,appearance,busy,onEdge])
    const current=useCallback(()=>active.current===owner&&source.isCurrent(),[owner,source])
    const flush=useCallback(()=>{
        let unavailable=false
        for(const [target,position] of pending.current){
            try{const raw=JSON.stringify(position);if(raw.length>2048)throw new Error('Reader position exceeds device bound');localStorage.setItem(target,raw);pending.current.delete(target)}
            catch{unavailable=true}
        }
        if(current())setStatus((old)=>({...old,owner,unavailable,changed:!unavailable&&!blocked.current?false:old.changed}))
    },[current,owner])
    const capture=useCallback((explicit=false)=>{
        if(!current()||!rootRef.current||!contentsRef.current)return null
        if(explicit){touched.current=true;blocked.current=false}
        const position=captureReaderPosition(rootRef.current,contentsRef.current,live.current.pages,scope,live.current.appearance)
        if(!position)return null
        if(key&&(!blocked.current||touched.current)){
            pending.current.set(key,position)
            if(timer.current)clearTimeout(timer.current)
            timer.current=setTimeout(flush,250)
        }
        return position
    },[current,rootRef,contentsRef,scope,key,flush])
    const restore=useCallback((position:ReaderPosition)=>{
        if(!current()||!rootRef.current||!contentsRef.current)return 'changed' as const
        ignore.current=true
        const result=restoreReaderPosition(rootRef.current,contentsRef.current,live.current.pages,position,live.current.appearance)
        lastTop.current=rootRef.current.scrollTop
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(current())ignore.current=false}))
        return result
    },[current,rootRef,contentsRef])
    useLayoutEffect(()=>{
        if(!current()||busy||!pages.length||!rootRef.current||!contentsRef.current)return
        const wasTransient=Boolean(transient.current),position=transient.current??(!restored.current?resume.current:null)
        transient.current=null
        if(position){
            const result=restore(position)
            if(!wasTransient)blocked.current=result==='changed'&&!touched.current
            if(result==='changed'&&!restored.current)setStatus((old)=>({...old,owner,changed:true}))
            if(result==='changed'&&wasTransient&&fallback.current){
                const element=Array.from(contentsRef.current.querySelectorAll<HTMLElement>('[data-reader-scene-id]')).find((node)=>node.dataset.readerSceneId===fallback.current)
                if(element){ignore.current=true;rootRef.current.scrollTop=Math.max(0,rootRef.current.scrollTop+element.getBoundingClientRect().top-rootRef.current.getBoundingClientRect().top);lastTop.current=rootRef.current.scrollTop}
            }
        }
        fallback.current=null
        restored.current=true
        // Capture the actual post-layout position, not an unbound raw offset.
        capture()
    },[pages,busy,current,rootRef,contentsRef,restore,capture,owner])
    useEffect(()=>{
        const element=rootRef.current
        if(!element)return
        const edge=(direction:'next'|'previous')=>{
            if(!current()||live.current.busy||!contentsRef.current)return
            const start=contentsRef.current.getBoundingClientRect().top-element.getBoundingClientRect().top+element.scrollTop
            if(direction==='next'?element.scrollHeight-element.scrollTop-element.clientHeight<=element.clientHeight/3:element.scrollTop-start<=element.clientHeight/4)live.current.onEdge(direction)
        }
        const queue=(direction?:'next'|'previous')=>{
            if(frame.current!==null)cancelAnimationFrame(frame.current)
            frame.current=requestAnimationFrame(()=>{
                frame.current=null;if(!current()||ignore.current)return
                capture();if(direction)edge(direction)
            })
        }
        const scroll=()=>{
            const next=element.scrollTop,delta=next-lastTop.current;lastTop.current=next
            if(ignore.current||Math.abs(delta)<1)return
            touched.current=true;blocked.current=false;queue(delta>0?'next':'previous')
        }
        const wheel=(event:WheelEvent)=>{if(!event.deltaY)return;touched.current=true;blocked.current=false;ignore.current=false;queue(event.deltaY>0?'next':'previous')}
        const keyboard=(event:KeyboardEvent)=>{
            if(!['ArrowDown','PageDown','ArrowUp','PageUp','Home','End',' '].includes(event.key))return
            if((event.target as HTMLElement).closest('input,textarea,select,button,a,[role="combobox"],[role="listbox"]'))return
            touched.current=true;blocked.current=false;ignore.current=false;queue(['ArrowUp','PageUp','Home'].includes(event.key)?'previous':'next')
        }
        const pointer=()=>{touched.current=true}
        const hidden=()=>{if(document.visibilityState==='hidden'){capture();flush()}}
        const pagehide=()=>{capture();flush()}
        element.addEventListener('scroll',scroll,{passive:true});element.addEventListener('wheel',wheel,{passive:true});element.addEventListener('keydown',keyboard);element.addEventListener('pointerdown',pointer)
        document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide)
        // Font loading can change geometry after the initial page paints. A
        // deliberate reading gesture retires this late automatic restoration.
        void document.fonts?.ready.then(()=>{if(current()&&!touched.current&&resume.current&&restored.current){restore(resume.current);capture()}})
        return()=>{
            element.removeEventListener('scroll',scroll);element.removeEventListener('wheel',wheel);element.removeEventListener('keydown',keyboard);element.removeEventListener('pointerdown',pointer)
            document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide)
            if(frame.current!==null)cancelAnimationFrame(frame.current)
            if(timer.current)clearTimeout(timer.current)
            flush()
        }
    },[rootRef,contentsRef,current,capture,flush,restore])
    return {initialSceneId:seed.position?.sceneId??null,storageUnavailable:status.owner===owner?status.unavailable:seed.unavailable,changed:status.owner===owner&&status.changed,
        capture:()=>{const position=capture();flush();return position},
        beforePageChange:(fallbackSceneId?:string)=>{transient.current=capture();fallback.current=fallbackSceneId??null},
        visibleSceneId:()=>current()&&rootRef.current&&contentsRef.current?captureReaderPosition(rootRef.current,contentsRef.current,live.current.pages,scope,live.current.appearance)?.sceneId??null:null,
        prepareRefresh:()=>{const position=capture(true);transient.current=null;resume.current=position;restored.current=false;return position?.sceneId??null},
        beginning:()=>{resume.current=null;transient.current=null;restored.current=true;blocked.current=false;touched.current=true;if(rootRef.current)rootRef.current.scrollTop=0},
    }
}
