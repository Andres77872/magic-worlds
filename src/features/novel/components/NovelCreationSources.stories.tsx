import { useState,type ComponentProps } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiError,type ApiService } from '@/infrastructure/api'
import type { StoryCreateRequest,LibraryQuery } from '@/shared'
import { WorkspaceTestProvider,createWorkspaceTestState } from '@/shared/hooks/testing/workspaceTestUtils'
import { Button,Callout } from '@/ui/primitives'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { novel } from '@/test/fixtures/story'
import type { CreationSourceApi } from '../hooks/useCreationSourceReview'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
import { NovelCreateModal } from './NovelCreateModal'
import { NovelCreationOrigin } from './NovelCreationOrigin'

const initial:StoryCreateRequest={title:'The glass road',source:{kind:'character',id:'mira',title:'Mira'},
    cardRefs:[{kind:'world',cardId:'gate',source:'source'}],
    approvedMaterials:[{key:'arrival',kind:'approved_adventure_material',title:'The gate encounter',text:'  Mira llegó 🙂.\nThe gate stayed shut.  '}],
    chapters:[{title:'At the gate',wordGoal:800}]}
const reader:CreationSourceApi={previewStoryCreationSources:async(selection)=>creationSourcesPreview(selection)}
const fixtureApi={...reader,withWorkspace(){return this},listCollections:async()=>({items:[]}),
    listLibraryCards:async(_workspaceId:string,query:LibraryQuery={})=>{
        const items=[{card_type:'character' as const,card:{id:'mira',name:'Mira'}},{card_type:'world' as const,card:{id:'gate',name:'The old gate'}}]
            .filter((item)=>(!query.card_type||query.card_type===item.card_type)&&(!query.q||item.card.name.toLowerCase().includes(query.q.toLowerCase())))
        return {items,total:items.length,limit:24,offset:0}
    }} as unknown as ApiService
const reviewWorkspace=createWorkspaceTestState({api:fixtureApi})
function SourceDemo({stale=false}:{stale?:boolean}){
    const [open,setOpen]=useState(true),[created,setCreated]=useState(false),[rejected,setRejected]=useState(false)
    return <WorkspaceTestProvider state={reviewWorkspace}><AuthContext.Provider value={auth}>
        <Button onClick={()=>{setCreated(false);setOpen(true)}}>Review novel sources</Button>
        {created&&<Callout tone="success" role="status">The glass road · reference snapshots approved; the manuscript starts empty.</Callout>}
        {open&&<NovelCreateModal open initialRequest={initial} creating={false} sourceApi={reader} onClose={()=>setOpen(false)} onCreate={async()=>{
            if(stale&&!rejected){setRejected(true);throw new ApiError(409,'Source changed',{code:'STORY_CREATION_SOURCE_CHANGED'})}
            setCreated(true);setOpen(false)
        }}/>}
    </AuthContext.Provider></WorkspaceTestProvider>
}
const meta={title:'Novel/Creation sources',component:SourceDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Review exact saved cards and author-approved passages before creating a novel. The controlled fixture performs no backend or model requests; creation leaves manuscript prose empty.'}}}} satisfies Meta<typeof SourceDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const ChangedBeforeCreation:Story={args:{stale:true}}
const origin={...creationSourcesPreview(initial),storyId:'source-novel',createdAt:'2026-10-16T10:30:00Z'}
const workspace:StoryWorkspace={workspaceId:'source-workspace',isCurrent:()=>true,detachedApi:()=>({getStoryCreationSources:async()=>origin}) as unknown as ReturnType<StoryWorkspace['detachedApi']>}
const auth={userHash:'source-fixture-author'} as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
export const FrozenOrigin:Story={render:()=> <AuthContext.Provider value={auth}><div className="p-6"><NovelCreationOrigin story={novel({id:'source-novel',organization:{workspace_id:'source-workspace'}})} workspace={workspace}/></div></AuthContext.Provider>}
