import {useMemo,useState} from 'react'
import type {Meta,StoryObj} from '@storybook/react-vite'
import {Button,Callout} from '@/ui/primitives'
import {novelAssistantReviewFixture} from '@/test/fixtures/novelAssistantReview'
import {NovelGenerationHistoryDrawer} from './NovelGenerationHistoryDrawer'

function HistoryReview({changed=false,readOnly=false}:{changed?:boolean;readOnly?:boolean}){
    const fixture=useMemo(()=>novelAssistantReviewFixture(),[])
    const [open,setOpen]=useState(true),[selected,setSelected]=useState(false)
    return <div className="space-y-3 p-4">
        <Button onClick={()=>setOpen(true)}>Open generation history</Button>
        {selected&&<Callout tone="info">The prior suggestion is selected for draft review. The manuscript is unchanged.</Callout>}
        <NovelGenerationHistoryDrawer open={open} onClose={()=>setOpen(false)} scopeKey="fictional-history-review" readOnly={readOnly}
            generations={[{...fixture.detail.generation,chapterTitle:fixture.detail.chapterTitle}]}
            onRefine={async(_generation,signal)=>{if(changed||signal.aborted)return false;setSelected(true);return true}}/>
    </div>
}
const meta={title:'Novel/Generation history',component:HistoryReview,tags:['autodocs'],args:{changed:false,readOnly:false},
    parameters:{layout:'fullscreen',docs:{description:{component:'Read the complete original output, copy it, and explicitly select a retained candidate for refinement. Failed selection leaves the original readable; archived reading has no refinement action. Controlled fictional callbacks make no API or provider requests. The writing-assistant stories demonstrate the connected draft handoff.'}}}
} satisfies Meta<typeof HistoryReview>
export default meta
type Story=StoryObj<typeof meta>
export const SavedWriting:Story={}
export const ChangedSuggestion:Story={args:{changed:true}}
export const ArchivedReading:Story={args:{readOnly:true}}
