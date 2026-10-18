import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Callout } from '@/ui/primitives'
import { outlineStory } from '@/test/fixtures/novelOutline'
import { NovelChapterRail,type OutlineTarget } from './NovelChapterRail'
import type { OutlineView } from '../utils/novelOutline'

function OutlineDemo({detailed=false,readOnly=false}:{detailed?:boolean;readOnly?:boolean}){
    const story=outlineStory(),[selected,setSelected]=useState('arrival'),[managed,setManaged]=useState<OutlineTarget|null>(null)
    const [view,setView]=useState<OutlineView>({numbers:true,details:detailed})
    return <div className="flex h-screen max-w-sm flex-col gap-3">
        {managed&&<Callout role="status">Selected details: {managed.kind} · {managed.id}</Callout>}
        <NovelChapterRail chapters={story.chapters} parts={story.parts} references={story.activeCardRefs} activeChapterId="chapter-one" activeSceneId={selected}
            onSelect={setSelected} onManage={setManaged} onAdd={()=>{}} readOnly={readOnly} view={view} onViewChange={setView}/>
    </div>
}
const meta={title:'Novel/Outline',component:OutlineDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'A compact or detailed outline over the same canonical scene model, with derived active numbering, independent goals, scoped cast/POV and revision-labelled summaries. These controlled fixtures make no backend requests.'}}},args:{detailed:false,readOnly:false}} satisfies Meta<typeof OutlineDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Compact:Story={}
export const Detailed:Story={args:{detailed:true}}
export const ReadOnly:Story={args:{detailed:true,readOnly:true}}
