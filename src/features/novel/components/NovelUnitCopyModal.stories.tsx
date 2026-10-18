import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button,Callout } from '@/ui/primitives'
import { unitCopyStory } from '@/test/fixtures/storyUnitCopy'
import { unitCopyOperation } from '@/shared/storyUnitCopy'
import { defaultStoryCopyOptions } from '@/shared/storyCopyOptions'
import { NovelUnitCopyModal } from './NovelUnitCopyModal'

function CopyDemo({kind='chapter',pending=false,loading=false}:{kind?:'chapter'|'scene';pending?:boolean;loading?:boolean}){
    const story=unitCopyStory(),source=kind==='chapter'?{kind,id:'chapter-1',title:'The gate'}:{kind,id:'scene-active',title:'At the gate'}
    const [open,setOpen]=useState(true),[created,setCreated]=useState(false)
    const operation=unitCopyOperation(story,kind,source.id,'Another gate',{...defaultStoryCopyOptions,includeNotes:false},{included:true,revision:5})!
    return <>
        <Button variant="secondary" onClick={()=>{setCreated(false);setOpen(true)}}>Duplicate {kind}</Button>
        {created&&<Callout tone="success">The independent copy is ready in the manuscript outline.</Callout>}
        {open&&<NovelUnitCopyModal source={source} loadSource={loading?()=>new Promise(()=>{}):async()=>story}
            loadAnnotations={async()=>({storyId:story.id,annotationRevision:5,scenes:[{sceneId:'scene-active',open:2,resolved:1,trashed:1},{sceneId:'scene-archived',open:4,resolved:0,trashed:0}]})}
            beforeWrite={async()=>true} operate={async()=>{setCreated(true);return story}} onClose={()=>setOpen(false)} pendingOperation={pending?operation:null}/>}
    </>
}
const story=unitCopyStory()
const meta={title:'Novel/Unit copy',component:NovelUnitCopyModal,tags:['autodocs'],
    parameters:{layout:'fullscreen',docs:{description:{component:'Review chapter/scene inclusion choices against a saved source. Confirmed copies start their own history. These fixtures make no API writes.'}}},
    args:{source:{kind:'chapter',id:'chapter-1',title:'The gate'},loadSource:async()=>story,beforeWrite:async()=>true,operate:async()=>story,onClose:()=>{}},
    render:()=> <CopyDemo/>,
} satisfies Meta<typeof NovelUnitCopyModal>
export default meta
type Story=StoryObj<typeof meta>
export const Chapter:Story={}
export const Scene:Story={render:()=> <CopyDemo kind="scene"/>}
export const PendingCopy:Story={render:()=> <CopyDemo pending/>}
export const SavingSource:Story={render:()=> <CopyDemo loading/>}
