import { studioIndex } from '@/test/fixtures/storyStudio'
import { useState,type ComponentProps } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { DataContext } from '@/app/providers/DataProvider'
import { AuthContext } from '@/app/providers/AuthProvider'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { Callout } from '@/ui/primitives'
import { creationAck,creationWrite } from '@/test/fixtures/storyCreation'
import { novel } from '@/test/fixtures/story'
import type { NovelCreations } from '../hooks/useNovelCreations'
import type { PendingNovelCreation } from '../persistence/creationJournal'
import { NovelCreateModal } from './NovelCreateModal'
import { NovelPendingCreations } from './NovelPendingCreations'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import type { ApiService } from '@/infrastructure/api'

type DataValue=NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
type NavigationValue=NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>
function RecoveryDemo({confirmed=false,storageFailed=false,dialog=false,rejected=false}:{confirmed?:boolean;storageFailed?:boolean;dialog?:boolean;rejected?:boolean}){
    const write={...creationWrite(),...(rejected?{expectedSourceVersion:'a'.repeat(64),approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Mira llegó 🙂.\nThe gate stayed shut.  '}]}:{})}
    const [items,setItems]=useState<PendingNovelCreation[]>([{schema:1,write:{write,...(confirmed?{ack:creationAck(write)}:{}),...(rejected?{rejected:'review_required' as const}:{})},storageFailed}])
    const [opened,setOpened]=useState(false),[visible,setVisible]=useState(true)
    const controller:NovelCreations={sessionKey:'fixture',items,busy:()=>false,
        start:async()=>studioIndex(novel()),
        retry:async(record)=>{if(record.write.rejected)return null;const ack=creationAck(record.write.write);setItems([{...record,write:{...record.write,ack}}]);return ack},
        open:async()=>{setItems([]);setVisible(false);return studioIndex(novel())},dismiss:()=>setItems([])}
    const navigation:NavigationValue={currentPage:'gallery-stories',setPage:()=>setOpened(true),goBack:()=>{},cardEdit:null,resourceEdit:null,replaceHash:()=>{},currentHash:'#gallery-stories',registerNavigationInterceptor:()=>()=>{}}
    const sourceApi={previewStoryCreationSources:async(selection:Parameters<ApiService['previewStoryCreationSources']>[0])=>creationSourcesPreview(selection)}
    return <AuthContext.Provider value={{userHash:'fixture-author'} as never}><WorkspaceContext.Provider value={{api:sourceApi,workspaceEpoch:1,selectedWorkspaceId:'fixture-workspace',workspaces:[]} as never}>
        <DataContext.Provider value={{novelCreations:controller,createStory:async()=>{setItems([]);return studioIndex(novel())}} as unknown as DataValue}>
        <NavigationContext.Provider value={navigation}>
            {opened&&<Callout tone="success">The gate is open in Story Studio.</Callout>}
            {dialog?<NovelCreateModal open={visible} creating={false} onClose={()=>setVisible(false)} onCreate={()=>{}} blocked={items.some((item)=>!item.write.ack&&!item.write.rejected)} recovery={<NovelPendingCreations/>}/>:<NovelPendingCreations/>}
        </NavigationContext.Provider>
    </DataContext.Provider></WorkspaceContext.Provider></AuthContext.Provider>
}
const meta={title:'Novel/Creation recovery',component:NovelPendingCreations,tags:['autodocs'],
    parameters:{layout:'padded',docs:{description:{component:'Recover an uncertain creation before retrying, then explicitly open its confirmed manuscript. Controlled fixtures make no backend requests.'}}},
    render:()=> <RecoveryDemo/>,
} satisfies Meta<typeof NovelPendingCreations>
export default meta
type Story=StoryObj<typeof meta>
export const Pending:Story={}
export const Confirmed:Story={render:()=> <RecoveryDemo confirmed/>}
export const DeviceStorageUnavailable:Story={render:()=> <RecoveryDemo storageFailed/>}
export const InCreateDialog:Story={render:()=> <RecoveryDemo dialog/>}
export const RejectedDraft:Story={render:()=> <RecoveryDemo rejected/>}
