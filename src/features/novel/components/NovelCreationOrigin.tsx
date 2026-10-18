import { useEffect,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import type { StoryOutline,StoryCreationSources } from '@/shared'
import type { StoryImportRecord } from '@/shared/types/storyImport.types'
import { novelMutationKey } from '@/shared/novelMutationJournal'
import { verifyCreationSources } from '@/infrastructure/api/storyCreationSourcesContract'
import { Button,Callout } from '@/ui/primitives'
import { CreationSourceSnapshots } from './NovelCreationSources'
import { NovelImportOrigin } from './NovelImportOrigin'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'

export function NovelCreationOrigin({story,workspace}:{story:StoryOutline;workspace:StoryWorkspace}){
    const {userHash}=useAuth()
    const key=novelMutationKey('creation-origin',{userHash,workspaceId:story.organization?.workspace_id,storyId:story.id},'read')
    return story.copiedFrom?null:<OriginReader key={key??story.id} story={story} workspace={workspace}/>
}
function OriginReader({story,workspace}:{story:StoryOutline;workspace:StoryWorkspace}){
    const {t}=useTranslation()
    const [open,setOpen]=useState(false),[result,setResult]=useState<{value:StoryCreationSources|null;imported:StoryImportRecord|null}|null>(null),[failed,setFailed]=useState(false)
    useEffect(()=>{
        const api=workspace.detachedApi()
        if(!open||!api||!workspace.isCurrent())return
        let current=true
        // A novel is created from sources or imported from a file; each origin is read from its own record.
        Promise.all([api.getStoryCreationSources(story.id),api.getStoryImportRecord(story.id)]).then(([value,imported])=>{
            if(value!==null&&!verifyCreationSources(value,story.id))throw new Error('Invalid creation origin')
            if(current&&workspace.isCurrent())setResult({value,imported})
        }).catch(()=>{if(current&&workspace.isCurrent())setFailed(true)})
        return()=>{current=false}
    },[open,workspace,story.id])
    return <div className="space-y-3">
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={()=>{if(!open){setFailed(false);setResult(null)}setOpen((value)=>!value)}}>{t('novelEditor.sources.origin')}</Button>
        {open&&<Callout tone="info">
            {failed?<p role="alert">{t('novelEditor.sources.originFailed')}</p>:result?.imported?<NovelImportOrigin record={result.imported} workspace={workspace}/>:result?.value?<>
                <p>{t('novelEditor.sources.originDescription',{date:new Date(result.value.createdAt).toLocaleString()})}</p>
                <p className="mb-3 text-caption text-parchment-300">{t('novelEditor.sources.originHelp')}</p>
                <CreationSourceSnapshots value={result.value}/>
            </>:result?<p>{t('novelEditor.sources.originMissing')}</p>:<p role="status">{t('novelEditor.sources.loading')}</p>}
        </Callout>}
    </div>
}
