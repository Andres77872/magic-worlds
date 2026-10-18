import { useMemo,useRef,useState } from 'react'
import type { Meta,StoryObj } from '@storybook/react-vite'
import { Button } from '@/ui/primitives'
import type { StoryAnnotation,StoryAnnotationSelection,StoryAnnotationWrite } from '@/shared'
import { canonicalJson } from '@/utils/json'
import { currentRevisionScene,revisionHead } from '@/test/fixtures/storyRevisions'
import { noteAnchor,notePage,noteSummary,personalNote } from '@/test/fixtures/storyAnnotations'
import type { PersonalAnnotations,AnnotationConfirmation } from '../hooks/usePersonalAnnotations'
import type { PersonalNoteDraft } from '../hooks/useAnnotationDrafts'
import type { AnnotationDraft,AnnotationIntent } from '../persistence/annotationJournal'
import { NovelAnnotationDrawer } from './NovelAnnotationDrawer'
import { NovelPendingAnnotations } from './NovelPendingAnnotations'

const passage:StoryAnnotationSelection={sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:8,quote:'The gate'}
const original:AnnotationIntent={storyId:'story-1',write:{requestId:'controlled-note-request',operation:{op:'edit',id:'note-1',expectedRevision:2,body:'Clarify what Mira risks by entering the gate.'}}}
export function PersonalNotesDemo({archived=false,orphaned=false,uncertain=false,bookmarks=false,onOpenBookmark}:{archived?:boolean;orphaned?:boolean;uncertain?:boolean;bookmarks?:boolean;onOpenBookmark?:(note:StoryAnnotation)=>Promise<boolean>}){
    const [open,setOpen]=useState(true),[drafts,setDrafts]=useState<PersonalNoteDraft[]>([]),[pending,setPending]=useState(uncertain)
    const [confirmation,setConfirmation]=useState<AnnotationConfirmation|null>(null)
    const anchor=bookmarks?noteAnchor({quote:'',start:{nodeId:'current-gate',offset:9},end:{nodeId:'current-gate',offset:9}}):noteAnchor()
    const notes=useRef<StoryAnnotation[]>([personalNote({...(bookmarks?{kind:'bookmark' as const,body:'Mira’s choice at the gate',origin:anchor,anchor,lastAnchor:anchor}:{}),head:revisionHead({readOnly:archived}),...(orphaned?{anchor:null,anchorState:'orphaned' as const,orphanReason:'passage_changed' as const}:{})})])
    const selected=bookmarks?{...passage,startOffset:9,endOffset:9,quote:''}:passage
    const pendingIntent:AnnotationIntent=bookmarks?{...original,kind:'bookmark',write:{...original.write,operation:{op:'edit',kind:'bookmark',id:'note-1',expectedRevision:2,body:'Mira’s choice — reviewed bookmark label'}}}:original
    const source=useMemo(()=>({key:'controlled-personal-notes',storyId:'story-1',isCurrent:()=>true,
        page:async(query:Parameters<NonNullable<PersonalAnnotations['source']>['page']>[0])=>notePage({items:notes.current.filter((note)=>(note.kind??'note')===(query.kind??'note')&&(!query.state||note.state===query.state)&&(!query.anchorState||note.anchorState===query.anchorState)&&(!query.q||note.body.toLocaleLowerCase().includes(query.q.toLocaleLowerCase()))).map((note)=>noteSummary({...('kind' in note?{kind:note.kind}:{}),id:note.id,bodyPreview:note.body.slice(0,160),quotePreview:note.lastAnchor.quote,revision:note.revision,anchorVersion:note.anchorVersion,state:note.state,anchorState:note.anchorState,orphanReason:note.orphanReason,readOnly:archived}))}),
        detail:async(id:string)=>{const note=notes.current.find((value)=>value.id===id);if(!note)throw new Error('Note missing');return structuredClone(note)},currentScene:async()=>currentRevisionScene(),
    }),[archived])
    const retire=(record:PersonalNoteDraft)=>setDrafts((rows)=>rows.filter((row)=>canonicalJson(row.write)!==canonicalJson(record.write)))
    const confirm=async(write:StoryAnnotationWrite,binding?:PersonalNoteDraft)=>{
        const op=write.operation,previous=notes.current.find((note)=>note.id===op.id)
        const fresh=op.op==='create'?personalNote({...(op.kind?{kind:op.kind}:{}),id:op.id,body:op.body,revision:1,anchorVersion:1,origin:anchor,lastAnchor:anchor,anchor}):{
            ...previous!,...(op.op==='edit'?{body:op.body,revision:op.expectedRevision+1}:op.op==='set_state'?{state:op.state,revision:op.expectedRevision+1}:{anchor,lastAnchor:anchor,anchorState:'attached' as const,orphanReason:null,anchorVersion:op.expectedAnchorVersion+1}),
        }
        notes.current=[fresh,...notes.current.filter((note)=>note.id!==op.id)]
        if(binding)retire(binding)
        setConfirmation({scopeKey:source.key,intent:{storyId:'story-1',...(op.kind?{kind:op.kind}:{}),write,...(binding?{draft:binding}:{})},note:fresh})
        return fresh
    }
    const annotations:PersonalAnnotations={source,confirmation,
        drafts:{items:drafts,save:(write:AnnotationDraft)=>{const record:PersonalNoteDraft={schema:1,write:structuredClone(write),storageKey:'controlled-note-draft'};setDrafts((rows)=>[record,...rows.filter((row)=>row.write.annotationId!==write.annotationId)]);return record},remove:retire,confirm:(intent)=>{if(intent.draft)retire(intent.draft)}},
        mutations:{items:pending?[{schema:1,write:pendingIntent}]:[],error:null,hasPending:(id)=>pending&&(!id||id==='note-1'),busy:()=>false,clearError:()=>{},start:confirm,recover:async(record)=>{const fresh=await confirm(record.write.write,record.write.draft);setPending(false);return fresh}},
    }
    return <div className="space-y-4">
        <NovelPendingAnnotations annotations={annotations} onOpen={()=>setOpen(true)}/>
        <Button onClick={()=>setOpen(true)}>{bookmarks?'Read bookmarks':'Read personal notes'}</Button>
        <NovelAnnotationDrawer kind={bookmarks?'bookmark':'note'} open={open} onClose={()=>setOpen(false)} annotations={annotations} activeSceneId="scene-1" readOnly={archived} captureSelection={async()=>selected} beforeWrite={async()=>true} onOpenAnchor={onOpenBookmark}/>
    </div>
}
const meta={title:'Novel/Personal notes',component:PersonalNotesDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Personal review notes with separate passage attachment, retained device drafts, explicit reattachment and request recovery. Controlled local examples make no backend request.'}}},args:{archived:false,orphaned:false,uncertain:false}} satisfies Meta<typeof PersonalNotesDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const NeedsReattachment:Story={args:{orphaned:true}}
export const Archived:Story={args:{archived:true}}
export const PendingRecovery:Story={args:{uncertain:true}}
