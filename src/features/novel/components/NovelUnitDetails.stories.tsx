import { useLayoutEffect,useMemo,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { apiService } from '@/infrastructure/api'
import type { StoryNovelWrite } from '@/shared'
import { novel,storyReference } from '@/test/fixtures/story'
import coverArtwork from '@/assets/marketing/features/story-writer.webp'
import { NovelUnitDetails } from './NovelUnitDetails'

const workspaceId='11111111-1111-4111-8111-111111111111'
function MetadataDemo({missingCover=false,readOnly=false}:{missingCover?:boolean;readOnly?:boolean}){
    const [story,setStory]=useState(()=>novel({title:'The remembered road',organization:{workspace_id:workspaceId},activeCardRefs:[storyReference()],
        details:{genre:'Fantasy',language:'English',tags:['Journeys','Memory'],povCardId:'mira',tense:'past',coverAssetId:missingCover?'controlled-missing-cover':null,coverAlt:'A writer at a candlelit desk.'}}))
    useLayoutEffect(()=>{
        const previous=apiService.fetchProtectedMediaBlob
        const fixture:typeof previous=async(url)=>{
            if(!url.includes('/images/assets/controlled-')||url.includes('controlled-missing'))throw new Error('Controlled unavailable preview')
            const response=await fetch(coverArtwork)
            return response.blob()
        }
        apiService.fetchProtectedMediaBlob=fixture
        return()=>{if(apiService.fetchProtectedMediaBlob===fixture)apiService.fetchProtectedMediaBlob=previous}
    },[])
    const workspace=useMemo(()=>{
        const api={listWorkspaceMedia:async()=>({items:['controlled-cover','controlled-missing-cover'].map((id)=>({media_kind:'image' as const,asset_id:id,job_id:null,organization:{workspace_id:workspaceId},asset:{asset_id:id,url:'/images/assets/'+id}})),total:2,limit:24,offset:0}),
            uploadCardImage:async()=>({asset_id:'controlled-upload',url:'/images/assets/controlled-upload',content_type:'image/webp' as const})}
        return {workspaceId,isCurrent:()=>true,detachedApi:()=>api as never}
    },[])
    const data={refreshStory:async()=>story,updateStory:async(_id:string,write:StoryNovelWrite)=>{
        const next={...story,...write,details:write.details??story.details,metadataRevision:story.metadataRevision+1}
        setStory(next);return next
    }}
    return <AuthContext.Provider value={{userHash:'controlled-cover-author'} as never}><DataContext.Provider value={data as never}>
        <div className="mx-auto max-w-3xl p-6"><NovelUnitDetails story={story} unit={story} kind="novel" workspace={workspace} readOnly={readOnly} beforeWrite={async()=>true}/></div>
    </DataContext.Provider></AuthContext.Provider>
}
const meta={title:'Novel/Novel details',component:MetadataDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Controlled local metadata, POV and owned-image choices. Media uses bundled artwork; an unavailable-file record remains selectable. Saving updates fixture state only and makes no backend calls.'}}},args:{missingCover:false,readOnly:false}} satisfies Meta<typeof MetadataDemo>
export default meta
type Story=StoryObj<typeof meta>
export const CoverAndDefaultPov:Story={}
export const MissingFileRecord:Story={args:{missingCover:true}}
export const ArchivedReadOnly:Story={args:{readOnly:true}}
