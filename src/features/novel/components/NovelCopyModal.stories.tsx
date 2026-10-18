import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button,Callout } from '@/ui/primitives'
import { copyAck,copyPreview } from '@/test/fixtures/storyCopy'
import type { NovelCopies } from '../hooks/useNovelCopies'
import { NovelCopyModal } from './NovelCopyModal'

const copies:NovelCopies={items:[],error:null,preview:async()=>copyPreview(true),start:async(_source,write)=>copyAck(write),retry:async()=>null,open:async()=>{},dismiss:()=>{},hasPending:()=>false,busy:()=>false}
function CopyDemo({controller=copies}:{controller?:NovelCopies}){
    const [open,setOpen]=useState(true),[created,setCreated]=useState(false)
    return <>
        <Button variant="secondary" onClick={()=>{setCreated(false);setOpen(true)}}>Duplicate novel</Button>
        {created&&<Callout tone="success">The independent draft is ready in your library.</Callout>}
        {open&&<NovelCopyModal source={{id:'story-1',title:'The gate'}} copies={controller} onClose={()=>setOpen(false)} onCopied={()=>setCreated(true)}/>}
    </>
}
const meta={title:'Novel/Novel copy',component:NovelCopyModal,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Reviews an independent novel copy with explicit notes, Codex and lifecycle choices. Ember marks deliberate creation; pending results remain recoverable.'}}},
    args:{source:{id:'story-1',title:'The gate'},copies,onClose:()=>{}},
    render:()=> <CopyDemo/>,
} satisfies Meta<typeof NovelCopyModal>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const Loading:Story={render:()=> <CopyDemo controller={{...copies,preview:()=>new Promise(()=>{})}}/>}
export const ArchivedSource:Story={render:()=> <CopyDemo controller={{...copies,preview:async()=>{
    const preview=copyPreview()
    return {...preview,variants:preview.variants.map((variant)=>({...variant,counts:{...variant.counts,chapters:variant.includeArchived?1:0,scenes:variant.includeArchived?1:0}}))}
}}}/>}
export const PendingRequest:Story={render:()=> <CopyDemo controller={{...copies,hasPending:()=>true}}/>}
