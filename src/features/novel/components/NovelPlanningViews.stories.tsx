import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button, Callout } from '@/ui/primitives'
import { outlineStory } from '@/test/fixtures/novelOutline'
import { NovelPlanningViews } from './NovelPlanningViews'

function timedStory(){
    const story=outlineStory(),scenes=story.chapters[0].scenes
    const scene=(id:string)=>scenes.find((item)=>item.id===id)!
    scene('arrival').details={...scene('arrival').details,storyTimeOrder:20,narrativeTime:'Dawn, day two',plotThreads:['The sealed gate']}
    scene('alternate').details={...scene('alternate').details,storyTimeOrder:5,narrativeTime:'A year earlier'}
    scene('answer').details={...scene('answer').details,plotThreads:['The sealed gate','A voice beyond']}
    return story
}

function PlanningDemo({blocked=false}:{blocked?:boolean}){
    const [story]=useState(timedStory),[open,setOpen]=useState(true),[active,setActive]=useState('arrival'),[note,setNote]=useState<string|null>(null)
    return <div className="flex flex-col gap-3 p-4">
        {note&&<Callout role="status">{note}</Callout>}
        <Button onClick={()=>setOpen(true)}>Open planning views</Button>
        <NovelPlanningViews open={open} onClose={()=>setOpen(false)} story={story} activeSceneId={active}
            onEditScene={(id)=>setNote('Scene details: '+id)}
            onOpenScene={async(id)=>{if(blocked)return false;setActive(id);setNote('Opened in Write: '+id);return true}}/>
    </div>
}
const meta={title:'Novel/Planning views',component:PlanningDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Board, timeline and matrix over one saved outline. Story-time order is separate from reading order, so flashbacks are flagged and unknown times are listed apart. These controlled fixtures make no backend requests.'}}},args:{blocked:false}} satisfies Meta<typeof PlanningDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Views:Story={}
export const BlockedByCurrentChange:Story={args:{blocked:true}}
