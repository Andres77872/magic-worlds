import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import type { StoryUnitWrite } from '@/shared'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { NovelUnitDetails } from './NovelUnitDetails'

function PlanningDemo({readOnly=false}:{readOnly?:boolean}){
    const [story,setStory]=useState(()=>novel({organization:{workspace_id:'planning-demo-workspace'},chapters:[storyChapter({scenes:[storyScene({
        title:'At the remembered gate',details:{tags:['Arrival','Hidden promise'],plannedBeats:['Mira discovers a second key.\nIts teeth match the old gate.','The keeper asks who sent her.','Mira leaves the question unanswered.'],summary:'Mira has reached the gate.',notes:'Keep the keeper’s motive uncertain.'},
    })]})]}))
    const unit=story.chapters[0].scenes[0]
    const data={refreshStory:async()=>story,updateStoryScene:async(_story:string,_scene:string,write:StoryUnitWrite)=>{
        const next={...unit,...write,details:write.details??unit.details,metadataRevision:unit.metadataRevision+1}
        setStory({...story,chapters:[{...story.chapters[0],scenes:[next]}]});return next
    }}
    return <AuthContext.Provider value={{userHash:'controlled-planning-author'} as never}><DataContext.Provider value={data as never}>
        <div className="mx-auto max-w-xl p-4"><NovelUnitDetails story={story} unit={unit} kind="scene" readOnly={readOnly} beforeWrite={async()=>true}/></div>
    </DataContext.Provider></AuthContext.Provider>
}
const meta={title:'Novel/Unit planning',component:PlanningDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Controlled unit tags and ordered planned beats, separate from written summaries and prose. Changes save only to fixture state; no backend or model calls.'}}},args:{readOnly:false}} satisfies Meta<typeof PlanningDemo>
export default meta
type Story=StoryObj<typeof meta>
export const ScenePlan:Story={}
export const ReadOnly:Story={args:{readOnly:true}}
