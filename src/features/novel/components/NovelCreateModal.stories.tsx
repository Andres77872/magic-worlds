import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import type { StoryCreateRequest } from '@/shared'
import { Button,Callout } from '@/ui/primitives'
import { templateCounts } from '../utils/writingTemplates'
import { NovelCreateModal } from './NovelCreateModal'
function CreationDemo(){
    const [open,setOpen]=useState(true),[created,setCreated]=useState<StoryCreateRequest|null>(null)
    return <>
        <Button onClick={()=>setOpen(true)}>Begin a new novel</Button>
        {created&&<Callout tone="success" role="status">{created.title} · {created.template?`${templateCounts(created.template).scenes} empty scenes; edited planning and writing defaults retained.`:'A blank opening is ready.'}</Callout>}
        <NovelCreateModal open={open} creating={false} onClose={()=>setOpen(false)} onCreate={(request)=>{setCreated(request);setOpen(false)}}/>
    </>
}
const meta={title:'Novel/Writing templates',component:CreationDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Edit a starter outline and its writing defaults before creating an independent novel. This controlled creation fixture makes no backend requests.'}}}} satisfies Meta<typeof CreationDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Create:Story={}
