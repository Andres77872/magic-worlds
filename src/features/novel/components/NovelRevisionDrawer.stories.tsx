import { useMemo,useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button,Callout } from '@/ui/primitives'
import { storyScene } from '@/test/fixtures/story'
import { currentRevisionScene,revisionHead,revisionPage,revisionSummary,sceneRevision,sceneRestoreAck } from '@/test/fixtures/storyRevisions'
import type { SceneRevisionSource } from '../hooks/useSceneRevisionSource'
import type { SceneRestoreIntent } from '../persistence/sceneRestoreJournal'
import { NovelRevisionDrawer } from './NovelRevisionDrawer'
import { NovelPendingSceneRestores } from './NovelPendingSceneRestores'

const original:SceneRestoreIntent={storyId:'story-1',sceneId:'scene-1',sceneTitle:'At the gate',revision:2,write:{requestId:'controlled-restore',expectedRevision:3,expectedContentHash:'c'.repeat(64),sourceContentHash:'b'.repeat(64)}}
const baseSource:SceneRevisionSource={key:'controlled-scene-history',storyId:'story-1',sceneId:'scene-1',isCurrent:()=>true,page:async()=>revisionPage(),detail:async()=>sceneRevision(),current:async()=>currentRevisionScene(),head:async()=>revisionHead()}
function SceneHistoryDemo({archived=false,uncertain=false}:{archived?:boolean;uncertain?:boolean}) {
    const [open,setOpen]=useState(true),[pending,setPending]=useState(uncertain),[confirmed,setConfirmed]=useState(false)
    const model=useRef({confirmed:false})
    const source=useMemo<SceneRevisionSource>(()=>{
        const current=()=>model.current.confirmed?storyScene({...currentRevisionScene(),revision:4,contentHash:'b'.repeat(64),document:sceneRevision().document}):currentRevisionScene()
        const head=()=>revisionHead({revision:current().revision,contentHash:current().contentHash,readOnly:archived})
        return {...baseSource,page:async(query)=>{
            const rows=model.current.confirmed?[revisionSummary({revision:4,parentRevision:3,source:'restore',restoredFrom:2}),revisionSummary()]:[revisionSummary()]
            return revisionPage({head:head(),items:rows.filter((row)=>(!query.source||query.source===row.source)&&(!query.actor||query.actor===row.actor)&&(!query.fromDate||row.createdAt.slice(0,10)>=query.fromDate)&&(!query.throughDate||row.createdAt.slice(0,10)<=query.throughDate))})
        },head:async()=>head(),current:async()=>current(),
            detail:async(revision)=>revision===4?sceneRevision({revision:4,parentRevision:3,source:'restore',restoredFrom:2}):sceneRevision()}
    },[archived])
    const restores={items:pending?[{schema:1 as const,write:original}]:[],error:null,hasPending:()=>pending,busy:()=>false,clearError:()=>{},
        start:async(request:SceneRestoreIntent)=>{model.current.confirmed=true;setConfirmed(true);return sceneRestoreAck(request.write)},recover:async()=>{model.current.confirmed=true;setPending(false);setConfirmed(true);return sceneRestoreAck(original.write)}}
    return <div className="space-y-4">
        {confirmed&&<Callout role="status">The scene text restore is confirmed as revision 4. Current notes remain available.</Callout>}
        <NovelPendingSceneRestores restores={restores}/>
        <Button onClick={()=>setOpen(true)}>Browse scene history</Button>
        <NovelRevisionDrawer open={open} onClose={()=>setOpen(false)} source={source} readOnly={archived} beforeWrite={async()=>true} restores={restores}/>
    </div>
}
const meta={title:'Novel/Scene history',component:NovelRevisionDrawer,tags:['autodocs'],
    parameters:{layout:'fullscreen',docs:{description:{component:'Read filtered scene checkpoints, compare saved prose, copy an excerpt and review an explicit restore. These local fixtures make no backend request.'}}},
    args:{open:true,onClose:()=>{},source:baseSource,readOnly:false,beforeWrite:async()=>true,restores:{items:[],error:null,hasPending:()=>false,busy:()=>false,clearError:()=>{},start:async(request)=>sceneRestoreAck(request.write),recover:async()=>null}},
    render:()=> <SceneHistoryDemo/>,
} satisfies Meta<typeof NovelRevisionDrawer>
export default meta
type Story=StoryObj<typeof meta>
export const ReadAndRestore:Story={}
export const Archived:Story={render:()=> <SceneHistoryDemo archived/>}
export const PendingRecovery:Story={render:()=> <SceneHistoryDemo uncertain/>}
