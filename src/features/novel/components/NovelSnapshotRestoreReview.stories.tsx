import { snapshotNoteReaders } from '@/test/fixtures/storySnapshotNotes'
import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button,Callout } from '@/ui/primitives'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { snapshotComparison,snapshotPage,snapshotPreview,snapshotRestoreOptions,snapshotRestorePreview,snapshotStory,snapshotView } from '@/test/fixtures/storySnapshots'
import { NovelSnapshotRestoreReview } from './NovelSnapshotRestoreReview'

const source:StorySnapshotSource={...snapshotNoteReaders,key:'restore-preview',isCurrent:()=>true,
    preview:async()=>snapshotPreview(),list:async()=>snapshotPage(),compare:async()=>snapshotComparison(),
    scene:async()=>snapshotView(),currentScene:async()=>snapshotStory(true).chapters[0].scenes[0],restorePreview:async(_id,options)=>snapshotRestorePreview(options)}
function RestoreDemo({archived=false,uncertain=false}:{archived?:boolean;uncertain?:boolean}) {
    const [open,setOpen]=useState(true),[complete,setComplete]=useState(false)
    return <div className="space-y-4">
        {complete&&<Callout role="status">The controlled manuscript restore is confirmed. Its earlier writing remains in history.</Callout>}
        <Button onClick={()=>{setComplete(false);setOpen(true)}}>Review manuscript restore</Button>
        <NovelSnapshotRestoreReview open={open} onClose={()=>setOpen(false)} onRestored={()=>{setOpen(false);setComplete(true)}} snapshot={snapshotComparison()} source={source}
            structureRevision={5} readOnly={archived} busy={false} beforeWrite={async()=>true} operate={async()=>snapshotStory()} recover={async()=>{setOpen(false);setComplete(true);return snapshotStory()}}
            pendingOperation={uncertain?{op:'restore_snapshot',snapshotId:3,manifestHash:'d'.repeat(64),expectedSourceVersion:'c'.repeat(64),sourceStructureRevision:5,options:snapshotRestoreOptions()}:null}/>
    </div>
}
const meta={title:'Novel/Manuscript snapshot restore',component:NovelSnapshotRestoreReview,tags:['autodocs'],
    parameters:{layout:'fullscreen',docs:{description:{component:'Review selected text, writing details, outline and Codex restoration before applying one recoverable manuscript operation. These controlled fixtures never write to the backend.'}}},
    args:{open:true,onClose:()=>{},onRestored:()=>{},snapshot:snapshotComparison(),source,structureRevision:5,readOnly:false,busy:false,beforeWrite:async()=>true,operate:async()=>snapshotStory(),recover:async()=>snapshotStory()},
    render:()=> <RestoreDemo/>,
} satisfies Meta<typeof NovelSnapshotRestoreReview>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const Archived:Story={render:()=> <RestoreDemo archived/>}
export const PendingRecovery:Story={render:()=> <RestoreDemo archived uncertain/>}
