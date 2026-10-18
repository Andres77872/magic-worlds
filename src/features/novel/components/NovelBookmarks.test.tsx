import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { StoryAnnotation,StoryAnnotationSelection,StoryAnnotationWrite } from '@/shared'
import { currentRevisionScene } from '@/test/fixtures/storyRevisions'
import { noteAnchor,notePage,noteSummary,personalNote } from '@/test/fixtures/storyAnnotations'
import type { PersonalAnnotations } from '../hooks/usePersonalAnnotations'
import type { PersonalNoteDraft } from '../hooks/useAnnotationDrafts'
import type { AnnotationDraft } from '../persistence/annotationJournal'
import { NovelAnnotationDrawer } from './NovelAnnotationDrawer'

const selection:StoryAnnotationSelection={sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:9,endOffset:9,quote:''}
const anchor=()=>noteAnchor({quote:'',start:{nodeId:'current-gate',offset:9},end:{nodeId:'current-gate',offset:9}})
const bookmark=(patch:Partial<StoryAnnotation>={})=>personalNote({id:'bookmark-1',kind:'bookmark',body:'Return to the crossing',origin:anchor(),anchor:anchor(),lastAnchor:anchor(),...patch})
let annotations:PersonalAnnotations
const start=vi.fn(),save=vi.fn(),capture=vi.fn(),before=vi.fn(),close=vi.fn(),openAnchor=vi.fn()
const props=()=>({open:true,kind:'bookmark' as const,onClose:close,annotations,readOnly:false,activeSceneId:'scene-1',captureSelection:capture,beforeWrite:before,onOpenAnchor:openAnchor})
beforeEach(()=>{
    vi.clearAllMocks();capture.mockResolvedValue(selection);before.mockResolvedValue(true);openAnchor.mockResolvedValue(true)
    save.mockImplementation((write:AnnotationDraft)=>({schema:1,write:structuredClone(write),storageKey:'controlled-bookmark-draft'} satisfies PersonalNoteDraft))
    start.mockImplementation(async(write:StoryAnnotationWrite)=>{const op=write.operation;return bookmark({id:op.id,revision:op.op==='create'?1:op.op==='reanchor'?op.expectedRevision:op.expectedRevision+1,
        ...('body' in op?{body:op.body}:{}),...(op.op==='set_state'?{state:op.state}:{}),...(op.op==='reanchor'?{anchorVersion:op.expectedAnchorVersion+1}:{})})})
    annotations={source:{key:'bookmark-owner',storyId:'story-1',isCurrent:()=>true,page:vi.fn().mockResolvedValue(notePage({items:[noteSummary({id:'bookmark-1',kind:'bookmark',bodyPreview:bookmark().body,quotePreview:''})]})),
        detail:vi.fn().mockResolvedValue(bookmark()),currentScene:vi.fn().mockResolvedValue(currentRevisionScene())},confirmation:null,
        drafts:{items:[],save,remove:vi.fn(),confirm:vi.fn()},mutations:{items:[],error:null,start,recover:vi.fn(),hasPending:()=>false,busy:()=>false,clearError:vi.fn()}}
})
const choose=async()=>{fireEvent.click(await screen.findByRole('button',{name:new RegExp(bookmark().body)}));await screen.findByRole('region',{name:'Edit bookmark'})}

it('reads bookmark pages separately and deliberately saves a labelled cursor bookmark with its exact kind and source',async()=>{
    render(<NovelAnnotationDrawer {...props()}/>);await screen.findByText(bookmark().body)
    expect(annotations.source!.page).toHaveBeenCalledWith({kind:'bookmark',state:'open'})
    fireEvent.click(screen.getByRole('button',{name:'Bookmark cursor or selection'}))
    await screen.findByRole('region',{name:'New bookmark'})
    fireEvent.change(screen.getByRole('textbox',{name:'Bookmark label'}),{target:{value:'The second crossing'}})
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({kind:'bookmark',selection,body:'The second crossing'}),expect.anything())
    fireEvent.click(screen.getByRole('button',{name:'Save bookmark'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start).toHaveBeenCalledWith({requestId:expect.any(String),operation:{op:'create',id:expect.any(String),kind:'bookmark',body:'The second crossing',anchor:selection}},expect.objectContaining({write:expect.objectContaining({kind:'bookmark'})}),'bookmark')
})

it('keeps point context readable, offers exact navigation and omits note resolution actions',async()=>{
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    expect(screen.queryByRole('button',{name:'Resolve note'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Read saved passage'}))
    const passage=await screen.findByRole('region',{name:'Saved passage context'})
    expect(within(passage).getByLabelText('Cursor position in the saved scene')).toHaveTextContent('│')
    expect(passage).toHaveTextContent('The gate');expect(start).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Go to bookmark'}))
    await waitFor(()=>expect(openAnchor).toHaveBeenCalledWith(bookmark()));expect(close).toHaveBeenCalled()
})

it('retains separate device drafts and independent content CAS while bounding labels by Unicode characters',async()=>{
    const draft=(kind?:'bookmark'):PersonalNoteDraft=>({schema:1,write:{storyId:'story-1',annotationId:kind?'other-bookmark':'other-note',...(kind?{kind}:{}),body:kind?'Unsent bookmark label':'Private review note',sequence:0,mode:'edit',selection:null,baseRevision:1,originalBody:'Prior text'}})
    annotations.drafts.items=[draft(),draft('bookmark')]
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    expect(screen.getByText('Unsent bookmark label')).toBeInTheDocument();expect(screen.queryByText('Private review note')).not.toBeInTheDocument()
    const input=screen.getByRole('textbox',{name:'Bookmark label'})
    fireEvent.change(input,{target:{value:'🌒'.repeat(256)}});expect(input).toHaveValue(bookmark().body)
    fireEvent.change(input,{target:{value:'🌒'.repeat(255)}});expect(input).toHaveValue('🌒'.repeat(255))
    fireEvent.click(screen.getByRole('button',{name:'Save bookmark'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start.mock.calls[0][0].operation).toEqual({op:'edit',kind:'bookmark',id:'bookmark-1',expectedRevision:2,body:'🌒'.repeat(255)})
    expect(before).not.toHaveBeenCalled()
})

it('reviews a point reattachment with saved context and sends both independent versions only after confirmation',async()=>{
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    const trigger=screen.getByRole('button',{name:'Move to cursor or selection'});trigger.focus();fireEvent.click(trigger)
    const review=await screen.findByRole('dialog',{name:'Review bookmark location'})
    expect(review).toHaveTextContent('At the gate');expect(start).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Move bookmark here'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start.mock.calls[0][0].operation).toEqual({op:'reanchor',kind:'bookmark',id:'bookmark-1',expectedRevision:2,expectedAnchorVersion:3,anchor:selection})
    await waitFor(()=>expect(trigger).toHaveFocus())
})

it('retains detached evidence and never opens another occurrence as its location',async()=>{
    annotations.source!.detail=vi.fn().mockResolvedValue(bookmark({anchor:null,anchorState:'orphaned',orphanReason:'passage_changed'}))
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    expect(screen.getByRole('button',{name:'Go to bookmark'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Read saved passage'}))
    await waitFor(()=>expect(annotations.source!.detail).toHaveBeenCalledTimes(2));expect(openAnchor).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled()
})
