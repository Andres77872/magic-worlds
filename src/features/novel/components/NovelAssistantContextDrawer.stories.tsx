import { useMemo,useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { ApiError } from '@/infrastructure/api'
import { assistantContextFixture,assistantContextVariants } from '@/test/fixtures/storyAssistantContext'
import { canonicalJson } from '@/utils/json'
import type { StoryAssistantContextOptions } from '@/shared/types/storyAssistant.types'
import { Button } from '@/ui/primitives'
import { NovelAssistantContextDrawer } from './NovelAssistantContextDrawer'

function ContextDemo({sourceChanged=false}:{sourceChanged?:boolean}){
    const [open,setOpen]=useState(false),attempt=useRef(0)
    const fixture=useMemo(()=>assistantContextFixture(),[]),variants=useMemo(()=>assistantContextVariants(),[])
    const source=useMemo(()=>({key:'fictional-assistant-source',storyId:fixture.index.id,isCurrent:()=>true,prepare:async(options:StoryAssistantContextOptions)=>{
        attempt.current++
        if(sourceChanged&&attempt.current===1)throw new ApiError(409,'Controlled saved-source change',{code:'STORY_ASSISTANT_SOURCE_CHANGED'})
        const variant=variants.find(row=>{const {sourceVersion,...expected}=row.request;void sourceVersion;return canonicalJson(expected)===canonicalJson(options)})
        if(!variant)throw new ApiError(422,'This controlled story supports only its documented Python-compiled choices',{code:'STORY_CONTEXT_BUDGET_EXCEEDED'})
        return structuredClone(variant.result)
    }}),[fixture,sourceChanged,variants])
    return <div className="space-y-3"><Button onClick={()=>setOpen(true)}>Prepare assistant sources</Button><p className="text-body text-parchment-200">Fictional saved-source preview. Ask “How old is Aria?” and choose this scene, chapter or novel. Novel author analysis also includes a later revelation. These examples come from the Python compiler and make no backend or model request.</p>
        <NovelAssistantContextDrawer open={open} onClose={()=>setOpen(false)} source={source} story={fixture.index} anchorSceneId="scene-2" selection={{sceneId:'scene-2',expectedRevision:fixture.index.chapters[0].scenes[2].revision,expectedContentHash:fixture.index.chapters[0].scenes[2].contentHash,startOffset:0,endOffset:3,quote:'The'}}/>
    </div>
}
const meta={title:'Novel/Assistant sources',component:ContextDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Read-only saved-source preparation with exact citations, pinned conflicts, reading-order exclusions, conservative budgets and retained questions. Controlled fictional packets are exported by the actual Python compiler. Novel-bound conversations and reviewed proposal execution remain separate required D3 work.'}}},args:{sourceChanged:false}} satisfies Meta<typeof ContextDemo>
export default meta
type Story=StoryObj<typeof meta>
export const SavedSources:Story={}
export const ChangedSavedSource:Story={args:{sourceChanged:true}}
