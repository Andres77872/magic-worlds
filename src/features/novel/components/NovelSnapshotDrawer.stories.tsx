import { snapshotNoteReaders } from '@/test/fixtures/storySnapshotNotes'
import { useMemo,useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import type { StorySnapshotComparison,StorySnapshotCreateOperation,StorySnapshotSummary } from '@/shared'
import { snapshotComparison,snapshotManifest,snapshotOperation,snapshotPage,snapshotPreview,snapshotStory,snapshotSummary,snapshotView,snapshotRestorePreview } from '@/test/fixtures/storySnapshots'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { NovelSnapshotDrawer } from './NovelSnapshotDrawer'
import { Callout } from '@/ui/primitives'

function SnapshotDemo({archived=false,uncertain=false}:{archived?:boolean;uncertain?:boolean}) {
    const [head,setHead]=useState(5),[pending,setPending]=useState(uncertain)
    const [restored,setRestored]=useState(false)
    const current=useRef(5),rows=useRef<StorySnapshotSummary[]>([snapshotSummary()]),details=useRef(new Map<number,StorySnapshotComparison>([[3,snapshotComparison()]]))
    const source=useMemo<StorySnapshotSource>(()=>({...snapshotNoteReaders,key:'snapshot-preview',isCurrent:()=>true,
        preview:async()=>({...snapshotPreview(),structureRevision:current.current}),list:async()=>snapshotPage({items:rows.current}),
        compare:async(id)=>details.current.get(id)!,
        scene:async(id,scene,hash)=>({...snapshotView(),snapshotId:id,manifestHash:hash,scene:{...snapshotStory(id!==3).chapters[0].scenes[0],...scene}}),
        currentScene:async()=>snapshotStory(true).chapters[0].scenes[0],
        restorePreview:async(_id,options)=>({...snapshotRestorePreview(options),structureRevision:current.current}),
    }),[])
    const capture=async(operation:StorySnapshotCreateOperation)=>{
        const manifest=snapshotManifest(true);manifest.novel.structureRevision=current.current
        if(operation.sourceAnnotationRevision!==undefined)manifest.annotations={revision:operation.sourceAnnotationRevision,notes:[]}
        const id=++current.current,summary=snapshotSummary({id,name:operation.title,note:operation.note,sourceVersion:operation.expectedSourceVersion,manifestHash:'f'.repeat(64)})
        rows.current=[summary,...rows.current]
        const latest=snapshotManifest(true);latest.novel.structureRevision=id
        details.current.set(id,{...summary,manifest,current:latest})
        setHead(id);return {...snapshotStory(true),structureRevision:id}
    }
    if(restored)return <Callout role="status">The controlled manuscript restore is confirmed. Its earlier writing remains in history.</Callout>
    return <NovelSnapshotDrawer open onClose={()=>{}} source={source} structureRevision={head} readOnly={archived} busy={false} pendingOperation={pending?snapshotOperation():null}
        beforeWrite={async()=>true} operate={async(operation)=>{if(operation.op==='restore_snapshot'){setRestored(true);return {...snapshotStory(),structureRevision:head+1}}return operation.op==='create_snapshot'?capture(operation):null}}
        recover={async()=>{const result=await capture(snapshotOperation());setPending(false);return result}}/>
}
const source:StorySnapshotSource={...snapshotNoteReaders,key:'snapshot-preview',isCurrent:()=>true,preview:async()=>snapshotPreview(),list:async()=>snapshotPage(),compare:async()=>snapshotComparison(),scene:async()=>snapshotView(),currentScene:async()=>snapshotStory(true).chapters[0].scenes[0],restorePreview:async(_id,options)=>snapshotRestorePreview(options)}
const meta={title:'Novel/Manuscript snapshots',component:NovelSnapshotDrawer,tags:['autodocs'],
    parameters:{layout:'fullscreen',docs:{description:{component:'Named saved-state capture and read-only comparison with frozen scene/checkpoint and Codex data. These controlled fixtures never write to the backend.'}}},
    args:{open:true,onClose:()=>{},source,structureRevision:5,readOnly:false,busy:false,beforeWrite:async()=>true,operate:async()=>null,recover:async()=>null},
    render:()=> <SnapshotDemo/>,
} satisfies Meta<typeof NovelSnapshotDrawer>
export default meta
type Story=StoryObj<typeof meta>
export const Browser:Story={}
export const Archived:Story={render:()=> <SnapshotDemo archived/>}
export const PendingRecovery:Story={render:()=> <SnapshotDemo uncertain/>}
