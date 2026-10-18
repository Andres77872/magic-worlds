import { useEffect,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { StoryOutline,StoryCopyProvenance } from '@/shared'
import { Button,Callout } from '@/ui/primitives'

export function NovelCopyOrigin({story}:{story:StoryOutline}){
    const {t}=useTranslation()
    const {api,capture,isCurrent}=useWorkspace()
    const [visible,setVisible]=useState(false),[value,setValue]=useState<StoryCopyProvenance|null>(null),[error,setError]=useState(false)
    useEffect(()=>{
        if(!visible||!story.copiedFrom||!api)return
        let current=true;const owner=capture()
        api.getStoryCopyProvenance(story.id).then((result)=>{
            if(!current||!isCurrent(owner))return
            if(!result||result.sourceId!==story.copiedFrom){setError(true);return}
            setValue(result)
        }).catch(()=>{if(current&&isCurrent(owner))setError(true)})
        return()=>{current=false}
    },[visible,story.id,story.copiedFrom,api,capture,isCurrent])
    if(!story.copiedFrom)return null
    return <div className="space-y-3">
        <Button variant="secondary" size="sm" aria-expanded={visible} onClick={()=>setVisible((v)=>!v)}>{t('novelEditor.copyNovel.origin')}</Button>
        {visible&&<Callout tone="info">
            {error?<p role="alert">{t('novelEditor.copyNovel.originFailed')}</p>:value?<>
                <p>{t('novelEditor.copyNovel.originDescription',{title:value.sourceTitle,date:new Date(value.createdAt).toLocaleString()})}</p>
                <p>{t('novelEditor.copyNovel.counts',{...value.counts})}</p>
                {value.annotations&&<><p>{t('novelEditor.copyNovel.commentCount',{count:value.annotations.comments??value.annotations.count})}</p>{value.annotations.bookmarks!==undefined&&<p>{t('novelEditor.bookmarks.copyCount',{count:value.annotations.bookmarks})}</p>}</>}
                <ul className="mt-3 space-y-2">{(['includeNotes','includeContext','includeArchived','includeTrash'] as const).map((key)=><li key={key}>{t('novelEditor.copyNovel.'+key)} · {t('novelEditor.structure.'+(value.options[key]?'yes':'no'))}</li>)}</ul>
                <p>{t('novelEditor.copyNovel.historyHelp')}</p>
                <ul className="mt-3 space-y-2">{value.sourceRevisions.scenes.filter((scene)=>value.identityMap.scenes[scene.id]).map((scene)=><li key={scene.id}>{scene.title} · {t('novelEditor.copyNovel.sourceRevision',{revision:scene.revision})}</li>)}</ul>
            </>:<p role="status">{t('novelEditor.copyNovel.loading')}</p>}
        </Callout>}
    </div>
}
