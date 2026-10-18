import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import type { StoryStructureOperation,StoryUnitMetadata } from '@/shared'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { Callout } from '@/ui/primitives'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { OutlineTarget } from './NovelChapterRail'
import { NovelStructureDrawer } from './NovelStructureDrawer'

const stamp='2026-10-16T10:00:00'
const part=(id:string,title:string,trashedAt:string|null):StoryUnitMetadata=>({id,title,storyId:'story-1',metadataRevision:1,order:0,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt,copiedFrom:null})
function RestoreDemo({kind='scene',archivedWorkspace=false,creating=false}:{kind?:'scene'|'chapter';archivedWorkspace?:boolean;creating?:boolean}){
    const scene=storyScene({id:'retained-scene',chapterId:'retained-chapter',title:'The old gate',plainText:'Mira returns to the old gate. Her saved writing and personal notes remain recoverable.',trashedAt:creating?null:stamp})
    const story=novel({title:'The remembered gate',parts:[part('old-part','Earlier part',creating?null:stamp),part('safe-part','Second act',null)],chapters:[
        storyChapter({id:'retained-chapter',title:'Retained chapter',partId:'old-part',trashedAt:creating?null:stamp,scenes:[scene]}),
        storyChapter({id:'safe-chapter',title:'The return',partId:'safe-part',scenes:[]}),
    ]})
    const [target,setTarget]=useState<OutlineTarget>({kind,id:kind==='scene'?scene.id:'retained-chapter'})
    const [applied,setApplied]=useState<StoryStructureOperation|null>(null)
    // These contexts expose only controlled local readers. No backend client
    // or authenticated provider is mounted in this fixture.
    const unavailable=async()=>null
    const data={refreshStory:async()=>story,updateStory:unavailable,updateStoryPart:unavailable,updateStoryChapter:unavailable,updateStoryScene:unavailable,storyLifecycle:unavailable}
    if(applied)return <Callout role="status">{applied.op==='create'?'The controlled insertion is confirmed. Existing titles and writing are retained.':'The controlled restore is confirmed. The retained writing, context and history remain available.'}</Callout>
    return <AuthContext.Provider value={{userHash:'controlled-restore-author'} as never}><DataContext.Provider value={data as never}>
        <NovelStructureDrawer story={story} workspace={{workspaceId:'controlled-restore-workspace',isCurrent:()=>true,detachedApi:()=>null}} target={target} onSelect={setTarget} onClose={()=>{}}
            readOnly={archivedWorkspace} busy={false} beforeWrite={async()=>true} operate={async(operation)=>{setApplied(operation);return story}} splitCursor={()=>null} activeSceneId={scene.id}/>
    </DataContext.Provider></AuthContext.Provider>
}
const meta={title:'Novel/Organization recovery',component:RestoreDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Choose an active container and review a scene or chapter restore while its original parent remains in Trash. These controlled local examples make no backend requests.'}}},args:{kind:'scene',archivedWorkspace:false}} satisfies Meta<typeof RestoreDemo>
export default meta
type Story=StoryObj<typeof meta>
export const RestoreScene:Story={}
export const RestoreChapter:Story={args:{kind:'chapter'}}
export const ArchivedWorkspace:Story={args:{archivedWorkspace:true}}
export const InsertAfterSelected:Story={args:{creating:true}}
