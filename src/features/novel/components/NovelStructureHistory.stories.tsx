import { useMemo,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Callout } from '@/ui/primitives'
import { novel } from '@/test/fixtures/story'
import { historyDetail,historyPage } from '@/test/fixtures/storyHistory'
import { NovelStructureHistory,type StoryHistorySource } from './NovelStructureHistory'

function HistoryDemo({readOnly=false,pending=false}:{readOnly?:boolean;pending?:boolean}) {
    const [applied,setApplied]=useState(false)
    const source=useMemo<StoryHistorySource>(()=>({key:'storybook-history',isCurrent:()=>true,readPage:async()=>historyPage(),readRevision:async()=>historyDetail()}),[])
    return <div className="mx-auto max-w-3xl space-y-4 p-6">
        {applied&&<Callout tone="success">The reviewed outline change was applied to this preview.</Callout>}
        <NovelStructureHistory source={source} structureRevision={3} readOnly={readOnly} busy={false} pendingOperation={pending?{op:'undo_structure',revision:3,sourceStructureRevision:3}:null} beforeWrite={async()=>true} operate={async()=>{setApplied(true);return novel()}}/>
    </div>
}
const source:StoryHistorySource={key:'storybook-history',isCurrent:()=>true,readPage:async()=>historyPage(),readRevision:async()=>historyDetail()}
const meta={title:'Novel/Organization history',component:NovelStructureHistory,tags:['autodocs'],
    parameters:{layout:'fullscreen',docs:{description:{component:'Scoped outline history with comparison, filtering and reviewed undo/redo. Controlled fixtures make no backend writes.'}}},
    args:{source,structureRevision:3,readOnly:false,busy:false,beforeWrite:async()=>true,operate:async()=>novel()},
    render:()=> <HistoryDemo/>,
} satisfies Meta<typeof NovelStructureHistory>
export default meta
type Story=StoryObj<typeof meta>
export const History:Story={}
export const Archived:Story={render:()=> <HistoryDemo readOnly/>}
export const PendingRecovery:Story={render:()=> <HistoryDemo pending/>}
