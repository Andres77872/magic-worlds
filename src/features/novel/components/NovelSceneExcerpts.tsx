import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryOutline,StorySceneOutline,StoryStudioExcerpts } from '@/shared'
import { loadedStoryScene } from '@/shared/storyStudioState'
import { canonicalJson } from '@/utils/json'
import { Button,Callout } from '@/ui/primitives'

export type SceneExcerptReader=(source:StoryOutline,scenes:StorySceneOutline[],signal?:AbortSignal)=>Promise<StoryStudioExcerpts|null>
interface Props {source:StoryOutline;scenes:StorySceneOutline[];read?:SceneExcerptReader;onReady?:(ready:boolean)=>void}
export function NovelSceneExcerpts({source,scenes,read,onReady}:Props){
    const {t}=useTranslation(),text=(key:string,values?:Record<string,unknown>)=>t('novelEditor.loading.'+key,values)
    const list=useMemo(()=>canonicalJson(scenes.map(({id,revision,metadataRevision,contentHash})=>({id,revision,metadataRevision,contentHash}))),[scenes])
    const [position,setPosition]=useState({list,page:0}),page=position.list===list?position.page:0
    const shown=useMemo(()=>scenes.slice(page*20,page*20+20),[scenes,page])
    const key=useMemo(()=>canonicalJson([source.id,source.metadataRevision,source.structureRevision,source.contextRevision,page,list]),[source.id,source.metadataRevision,source.structureRevision,source.contextRevision,page,list])
    const legacy=shown.every(loadedStoryScene)
    const [state,setState]=useState<{key:string;items:StoryStudioExcerpts['items'];error:'previewFailed'|'previewChanged'|null}>({key:'',items:[],error:null})
    const live=useRef({read,onReady}),[retry,setRetry]=useState(0)
    useLayoutEffect(()=>{live.current={read,onReady}})
    useLayoutEffect(()=>{live.current.onReady?.(legacy||!shown.length)},[key,legacy,shown.length])
    useEffect(()=>{
        if(legacy||!shown.length)return
        let current=true;const abort=new AbortController()
        const reader=live.current.read
        if(!reader){setState({key,items:[],error:'previewFailed'});return}
        void reader(source,shown,abort.signal).then((value)=>{
            if(!current||abort.signal.aborted)return
            if(!value)throw new Error('Preview owner changed')
            setState({key,items:value.items,error:null});live.current.onReady?.(true)
        }).catch((error)=>{if(current&&!abort.signal.aborted){setState({key,items:[],error:error instanceof ApiError&&error.code==='STORY_STUDIO_SOURCE_CHANGED'?'previewChanged':'previewFailed'});live.current.onReady?.(false)}})
        return()=>{current=false;abort.abort()}
    },[source,shown,key,legacy,retry])
    const items=legacy?shown.map((scene)=>({sceneId:scene.id,text:loadedStoryScene(scene)?Array.from(scene.plainText).slice(0,240).join(''):'',truncated:loadedStoryScene(scene)&&Array.from(scene.plainText).length>240})):state.key===key?state.items:[]
    const error=state.key===key?state.error:null,loading=!legacy&&shown.length>0&&state.key!==key
    return <div className="space-y-3">
        {loading&&<p role="status" className="text-caption text-parchment-300">{text('previewLoading')}</p>}
        {error&&<Callout tone="warning" role="alert"><p>{text(error)}</p><Button size="sm" variant="secondary" onClick={()=>{live.current.onReady?.(false);setState({key:'',items:[],error:null});setRetry((old)=>old+1)}}>{text('previewRetry')}</Button></Callout>}
        <ol className="max-h-60 space-y-3 overflow-y-auto">{shown.map((scene)=>{
            const excerpt=items.find((item)=>item.sceneId===scene.id)
            return <li key={scene.id}><strong>{scene.title}</strong>{excerpt&&<p className="whitespace-pre-wrap text-caption text-parchment-300">{excerpt.text}{excerpt.truncated?'…':''}</p>}</li>
        })}</ol>
        {scenes.length>20&&<div className="flex flex-wrap items-center gap-2"><span role="status" className="text-caption text-parchment-300">{text('previewPage',{from:page*20+1,through:Math.min(scenes.length,page*20+20),total:scenes.length})}</span>
            <Button size="sm" variant="secondary" disabled={page===0||loading} onClick={()=>setPosition({list,page:page-1})}>{text('previous')}</Button>
            <Button size="sm" variant="secondary" disabled={(page+1)*20>=scenes.length||loading} onClick={()=>setPosition({list,page:page+1})}>{text('next')}</Button></div>}
    </div>
}
