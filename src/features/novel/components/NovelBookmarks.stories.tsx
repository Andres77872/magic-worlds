import { useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Callout } from '@/ui/primitives'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import type { StoryAnnotation } from '@/shared'
import { resolveAnnotationRange } from '@/shared/storyAnnotationAnchors'
import { currentRevisionScene } from '@/test/fixtures/storyRevisions'
import { makeRequestId } from '@/utils/uuid'
import { NovelEditor } from '../editor/NovelEditor'
import type { ManuscriptSearchTarget } from '../editor/extensions/manuscriptSearchTarget'
import { PersonalNotesDemo } from './NovelAnnotationDrawer.stories'

function BookmarksDemo({orphaned=false,archived=false,uncertain=false}:{orphaned?:boolean;archived?:boolean;uncertain?:boolean}){
    const [target,setTarget]=useState<ManuscriptSearchTarget|null>(null),[opened,setOpened]=useState(false),scene=currentRevisionScene()
    const open=async(note:StoryAnnotation)=>{
        if(!note.anchor)return false
        const range=resolveAnnotationRange(scene,note.anchor);if(!range)return false
        setTarget({document:scene.document,token:makeRequestId('controlled-bookmark'),startOffset:range.startOffset,endOffset:range.endOffset,quote:range.text,...(!range.text?{point:note.anchor.start}:{})});return true
    }
    return <div className="space-y-4 p-4">
        {opened&&<Callout role="status">Bookmark opened at its saved position. This controlled example makes no backend request.</Callout>}
        <NovelEditor initialDocument={scene.document} readOnly={archived} codexEntries={[]} searchTarget={target} onSearchReveal={(_token,applied)=>{setOpened(applied);setTarget(null)}}
            onDocumentChange={()=>{}} onRequestSaveFlush={async()=>true} onGenerate={async()=>{throw new Error('Generation is outside this controlled bookmark example')}}
            onAcceptGeneration={async()=>{}} onDiscardGeneration={async()=>{}} onCritiqueResult={()=>{}}/>
        <PersonalNotesDemo bookmarks orphaned={orphaned} archived={archived} uncertain={uncertain} onOpenBookmark={open}/>
    </div>
}
const meta={title:'Novel/Bookmarks',component:BookmarksDemo,tags:['autodocs'],decorators:[(Story)=><FloatingWindowsProvider><Story/></FloatingWindowsProvider>],parameters:{layout:'fullscreen',docs:{description:{component:'Controlled cursor bookmarks with labelled device drafts, exact saved-passage reading, deliberate reattachment, request recovery and a real editor cursor reveal. No backend requests.'}}},args:{orphaned:false,archived:false,uncertain:false}} satisfies Meta<typeof BookmarksDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const NeedsReattachment:Story={args:{orphaned:true}}
export const Archived:Story={args:{archived:true}}
export const PendingRecovery:Story={args:{uncertain:true}}
