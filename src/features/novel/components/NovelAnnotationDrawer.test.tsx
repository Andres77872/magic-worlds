import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { currentRevisionScene } from '@/test/fixtures/storyRevisions'
import { noteAnchor,notePage,noteSummary,noteWrite,personalNote } from '@/test/fixtures/storyAnnotations'
import type { StoryAnnotation,StoryAnnotationSelection,StoryAnnotationWrite } from '@/shared'
import type { PersonalAnnotations } from '../hooks/usePersonalAnnotations'
import type { PersonalNoteDraft } from '../hooks/useAnnotationDrafts'
import type { AnnotationDraft } from '../persistence/annotationJournal'
import { NovelAnnotationDrawer } from './NovelAnnotationDrawer'
import { NovelPendingAnnotations } from './NovelPendingAnnotations'

const download=vi.hoisted(()=>vi.fn())
vi.mock('@/utils/download',async(importOriginal)=>({...await importOriginal<typeof import('@/utils/download')>(),downloadBlob:download}))
const before=vi.fn(),capture=vi.fn(),start=vi.fn(),saveDraft=vi.fn(),removeDraft=vi.fn(),clipboard=vi.fn(),recover=vi.fn()
let annotations:PersonalAnnotations,current=true
const selection=():StoryAnnotationSelection=>({sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:8,quote:'The gate'})
const draft=(patch:Partial<AnnotationDraft>={}):PersonalNoteDraft=>({schema:1,storageKey:'device-writer',write:{storyId:'story-1',annotationId:'note-1',body:'Device review note.',sequence:2,mode:'edit',selection:null,baseRevision:1,originalBody:'Old account note.',...patch}})
const props=()=>({open:true,onClose:vi.fn(),annotations,readOnly:false,activeSceneId:'scene-1',captureSelection:capture,beforeWrite:before})
const choose=async()=>{fireEvent.click(await screen.findByText(personalNote().body));return screen.findByRole('region',{name:'Edit personal note'})}
const textbox=()=>screen.getByRole('textbox',{name:'Personal note'})
const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard')
beforeEach(()=>{
    vi.clearAllMocks();current=true;before.mockResolvedValue(true);capture.mockResolvedValue(selection());clipboard.mockResolvedValue(undefined);recover.mockResolvedValue(null)
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:clipboard}})
    saveDraft.mockImplementation((write:AnnotationDraft)=>({schema:1,write,storageKey:'device-writer'}))
    start.mockImplementation(async(write:StoryAnnotationWrite)=>{
        const op=write.operation
        return personalNote({id:op.id,revision:op.op==='create'?1:op.op==='reanchor'?op.expectedRevision:op.expectedRevision+1,...('body' in op?{body:op.body}:{}),...(op.op==='set_state'?{state:op.state}:{}),...(op.op==='reanchor'?{anchorVersion:op.expectedAnchorVersion+1,anchor:noteAnchor({quote:op.anchor.quote}),lastAnchor:noteAnchor({quote:op.anchor.quote})}:{})})
    })
    annotations={source:{key:'author:work-one:story-1',storyId:'story-1',isCurrent:()=>current,page:vi.fn().mockResolvedValue(notePage()),detail:vi.fn().mockResolvedValue(personalNote()),currentScene:vi.fn().mockResolvedValue(currentRevisionScene())},drafts:{items:[],save:saveDraft,remove:removeDraft,confirm:vi.fn()},mutations:{items:[],error:null,start,recover,hasPending:()=>false,busy:()=>false,clearError:vi.fn()},confirmation:null}
})
afterEach(()=>{if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else Reflect.deleteProperty(navigator,'clipboard')})

it('reads small summaries first, then the selected note and exact saved passage on demand',async()=>{
    render(<NovelAnnotationDrawer {...props()}/>);await screen.findByText(personalNote().body)
    expect(annotations.source!.detail).not.toHaveBeenCalled();expect(annotations.source!.currentScene).not.toHaveBeenCalled()
    await choose();fireEvent.click(screen.getByRole('button',{name:'Read saved passage'}))
    const context=await screen.findByRole('region',{name:'Saved passage context'})
    expect(within(context).getByText('The gate',{selector:'mark'})).toBeInTheDocument()
    expect(context).toHaveTextContent('The gate opens to the sea.');expect(start).not.toHaveBeenCalled();expect(before).not.toHaveBeenCalled()
})
it('retains each keystroke and a closed form, and keeps content CAS independent of passage tracking',async()=>{
    const p=props(),view=render(<NovelAnnotationDrawer {...p}/>);await choose()
    fireEvent.change(textbox(),{target:{value:'Final device sentence.'}})
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({body:'Final device sentence.',baseRevision:2,originalBody:personalNote().body}),undefined)
    view.rerender(<NovelAnnotationDrawer {...p} open={false}/>);view.rerender(<NovelAnnotationDrawer {...p}/>)
    expect(textbox()).toHaveValue('Final device sentence.')
    fireEvent.click(screen.getByRole('button',{name:'Save note'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start).toHaveBeenCalledWith({requestId:expect.any(String),operation:{op:'edit',id:'note-1',expectedRevision:2,body:'Final device sentence.'}},expect.objectContaining({write:expect.objectContaining({body:'Final device sentence.'})}))
    expect(before).not.toHaveBeenCalled();expect(annotations.source!.currentScene).not.toHaveBeenCalled()
})
it('keeps a new note and its frozen passage when a later save finds a changed scene',async()=>{
    annotations.source!.currentScene=vi.fn().mockResolvedValue({...currentRevisionScene(),revision:4})
    render(<NovelAnnotationDrawer {...props()}/>);fireEvent.click(screen.getByRole('button',{name:'Note selected passage'}))
    await screen.findByRole('region',{name:'New personal note'});fireEvent.change(textbox(),{target:{value:'Keep this observation.'}})
    fireEvent.click(screen.getByRole('button',{name:'Save note'}));await screen.findByText('The saved note or passage changed. Refresh and review the versions before applying.')
    expect(textbox()).toHaveValue('Keep this observation.');expect(start).not.toHaveBeenCalled();expect(capture).toHaveBeenCalledOnce()
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({body:'Keep this observation.',selection:selection()}),expect.anything())
})
it('retains newer text after an earlier note write finishes and requires deliberate rebasing and saving',async()=>{
    let finish!:(value:StoryAnnotation)=>void
    start.mockImplementationOnce(()=>new Promise<StoryAnnotation>((resolve)=>{finish=resolve}))
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    fireEvent.change(textbox(),{target:{value:'Sent text.'}});fireEvent.click(screen.getByRole('button',{name:'Save note'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce());fireEvent.change(textbox(),{target:{value:'Newer unsent text.'}})
    await act(async()=>finish(personalNote({body:'Sent text.',revision:3})))
    const comparison=await screen.findByRole('region',{name:'Compare note versions'})
    expect(textbox()).toHaveValue('Newer unsent text.');expect(within(comparison).getByRole('textbox',{name:'Current account note'})).toHaveValue('Sent text.')
    expect(screen.getByRole('button',{name:'Save note'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Keep device text on this account version'}));expect(start).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button',{name:'Save note'}));await waitFor(()=>expect(start).toHaveBeenCalledTimes(2))
    expect(start.mock.calls[1][0].operation).toEqual({op:'edit',id:'note-1',expectedRevision:3,body:'Newer unsent text.'})
})
it('offers explicit device/account comparison after a conflict without replacing the device note',async()=>{
    start.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_ANNOTATION_CONFLICT'}))
    annotations.source!.detail=vi.fn().mockResolvedValueOnce(personalNote()).mockResolvedValue(personalNote({body:'Another account edit.',revision:4}))
    render(<NovelAnnotationDrawer {...props()}/>);await choose();fireEvent.change(textbox(),{target:{value:'Keep my review.'}})
    fireEvent.click(screen.getByRole('button',{name:'Save note'}));await screen.findByRole('region',{name:'Compare note versions'})
    expect(textbox()).toHaveValue('Keep my review.');expect(start).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button',{name:'Use account note'}));expect(textbox()).toHaveValue('Another account edit.')
    expect(removeDraft).toHaveBeenCalledWith(expect.objectContaining({write:expect.objectContaining({body:'Keep my review.'})}));expect(start).toHaveBeenCalledOnce()
})
it('reviews previous and new passages and sends both independent guards only after confirmation',async()=>{
    const next={...selection(),startOffset:9,endOffset:14,quote:'opens'};capture.mockResolvedValue(next)
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    fireEvent.click(screen.getByRole('button',{name:'Attach to selected passage'}))
    const review=await screen.findByRole('dialog',{name:'Review passage attachment'})
    expect(within(review).getByText('The gate')).toBeInTheDocument();expect(within(review).getByText('opens')).toBeInTheDocument();expect(start).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Attach note to this passage'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start.mock.calls[0][0].operation).toEqual({op:'reanchor',id:'note-1',expectedRevision:2,expectedAnchorVersion:3,anchor:next})
    expect(start.mock.calls[0][0].operation).not.toHaveProperty('body');expect(before).toHaveBeenCalledOnce()
})
it('keeps archived and orphaned notes readable and downloadable without pretending to locate a passage',async()=>{
    annotations.source!.detail=vi.fn().mockResolvedValue(personalNote({anchor:null,anchorState:'orphaned',orphanReason:'passage_changed'}));clipboard.mockRejectedValue(new Error('Unavailable'))
    render(<NovelAnnotationDrawer {...props()} readOnly/>);await choose()
    expect(textbox()).toHaveAttribute('readonly');expect(screen.getByRole('button',{name:'Save note'})).toBeDisabled();expect(screen.getByRole('button',{name:'Attach to selected passage'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Read saved passage'}));await waitFor(()=>expect(annotations.source!.detail).toHaveBeenCalledTimes(2))
    expect(annotations.source!.currentScene).not.toHaveBeenCalled();expect(screen.queryByRole('region',{name:'Saved passage context'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Copy note text'}));await screen.findByText('The clipboard is unavailable. Download the note to keep its text.')
    fireEvent.click(screen.getByRole('button',{name:'Download note text'}));expect(download).toHaveBeenCalledOnce();expect(start).not.toHaveBeenCalled()
})
it('keeps previously loaded summaries after failed pagination and rejects mixing collection heads',async()=>{
    annotations.source!.page=vi.fn().mockResolvedValueOnce(notePage({nextBefore:'2:note-1'})).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(notePage({annotationRevision:6,items:[noteSummary({id:'note-2',bodyPreview:'Newer collection.'})]}))
    render(<NovelAnnotationDrawer {...props()}/>);fireEvent.click(await screen.findByRole('button',{name:'Load earlier notes'}))
    await screen.findByRole('alert');expect(screen.getByText(personalNote().body)).toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Load earlier notes'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Load earlier notes'}))
    await screen.findByText('Personal notes changed. Refresh to see the latest state.')
    expect(annotations.source!.page).toHaveBeenLastCalledWith({state:'open',before:'2:note-1'});expect(screen.queryByText('Newer collection.')).not.toBeInTheDocument()
})
it('requires explicit adoption of a device draft and keeps its displayed base version for comparison',async()=>{
    annotations.drafts.items=[draft()]
    render(<NovelAnnotationDrawer {...props()}/>);await choose()
    expect(textbox()).toHaveValue(personalNote().body);expect(textbox()).toHaveAttribute('readonly');expect(saveDraft).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button',{name:'Continue device draft'})[0])
    await screen.findByRole('region',{name:'Compare note versions'});expect(textbox()).toHaveValue('Device review note.')
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({baseRevision:1,sequence:3}),draft());expect(start).not.toHaveBeenCalled()
})
it('updates a closed form from an exact recovered draft confirmation while retaining recovery outside the drawer',async()=>{
    const p=props(),view=render(<NovelAnnotationDrawer {...p}/>);await choose();fireEvent.change(textbox(),{target:{value:'Recovered text.'}})
    const binding=saveDraft.mock.results[0].value as PersonalNoteDraft,write:StoryAnnotationWrite={requestId:'recover-note',operation:{op:'edit',id:'note-1',expectedRevision:2,body:'Recovered text.'}}
    view.rerender(<NovelAnnotationDrawer {...p} open={false} annotations={{...annotations,confirmation:{scopeKey:annotations.source!.key,intent:{storyId:'story-1',write,draft:binding},note:personalNote({body:'Recovered text.',revision:3})}}}/>)
    view.rerender(<NovelAnnotationDrawer {...p} annotations={{...annotations,confirmation:{scopeKey:annotations.source!.key,intent:{storyId:'story-1',write,draft:binding},note:personalNote({body:'Recovered text.',revision:3})}}}/>)
    expect(textbox()).toHaveValue('Recovered text.');expect(screen.getByRole('button',{name:'Save note'})).toBeDisabled()
    annotations.mutations.items=[{schema:1,write:{storyId:'story-1',write:noteWrite()}}]
    render(<NovelPendingAnnotations annotations={annotations} onOpen={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Recover note request'}));expect(recover).toHaveBeenCalledWith(annotations.mutations.items[0])
})
it('does not copy under an old scope or show a late clipboard success beside newer input',async()=>{
    let finish!:()=>void
    clipboard.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    render(<NovelAnnotationDrawer {...props()}/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Copy note text'}))
    fireEvent.change(textbox(),{target:{value:'New input.'}});await act(async()=>finish());expect(screen.queryByText('Copied.')).not.toBeInTheDocument()
    current=false;fireEvent.click(screen.getByRole('button',{name:'Copy note text'}));fireEvent.click(screen.getByRole('button',{name:'Download note text'}))
    expect(clipboard).toHaveBeenCalledOnce();expect(download).not.toHaveBeenCalled()
})
it('keeps the current-scene filter current without replacing a retained note draft',async()=>{
    const p=props(),view=render(<NovelAnnotationDrawer {...p}/>);await choose();fireEvent.change(textbox(),{target:{value:'Retain this note.'}})
    fireEvent.click(screen.getByRole('combobox',{name:'Notes to show'}));fireEvent.click(screen.getByRole('option',{name:'Current scene'}))
    await waitFor(()=>expect(annotations.source!.page).toHaveBeenLastCalledWith({state:'open',sceneId:'scene-1'}))
    view.rerender(<NovelAnnotationDrawer {...p} activeSceneId="scene-2"/>)
    await waitFor(()=>expect(annotations.source!.page).toHaveBeenLastCalledWith({state:'open',sceneId:'scene-2'}));expect(textbox()).toHaveValue('Retain this note.')
})
it('ignores a late note detail after switching the author/root source',async()=>{
    let finish!:(value:StoryAnnotation)=>void
    annotations.source!.detail=vi.fn(()=>new Promise<StoryAnnotation>((resolve)=>{finish=resolve}))
    const p=props(),view=render(<NovelAnnotationDrawer {...p}/>);fireEvent.click(await screen.findByText(personalNote().body))
    const replacement={...annotations,source:{...annotations.source!,key:'other-author:work-two:story-two',storyId:'story-two',page:vi.fn().mockResolvedValue(notePage({storyId:'story-two',items:[]}))}}
    view.rerender(<NovelAnnotationDrawer {...p} annotations={replacement}/>)
    await act(async()=>finish(personalNote()))
    expect(screen.queryByRole('region',{name:'Edit personal note'})).not.toBeInTheDocument();expect(saveDraft).not.toHaveBeenCalled()
})
it('preserves newer device text while reviewing a replacement passage for an unsent note',async()=>{
    let finish!:(value:boolean)=>void
    before.mockImplementationOnce(()=>new Promise<boolean>((resolve)=>{finish=resolve}))
    render(<NovelAnnotationDrawer {...props()}/>);fireEvent.click(screen.getByRole('button',{name:'Note selected passage'}))
    await screen.findByRole('region',{name:'New personal note'});fireEvent.change(textbox(),{target:{value:'Earlier draft.'}})
    capture.mockResolvedValue({...selection(),startOffset:9,endOffset:14,quote:'opens'})
    fireEvent.click(screen.getByRole('button',{name:'Attach to selected passage'}));const review=await screen.findByRole('dialog',{name:'Review passage attachment'})
    fireEvent.click(within(review).getByRole('button',{name:'Attach note to this passage'}));await waitFor(()=>expect(before).toHaveBeenCalledOnce())
    fireEvent.change(textbox(),{target:{value:'Newer retained draft.'}});await act(async()=>finish(true))
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Review passage attachment'})).not.toBeInTheDocument())
    expect(textbox()).toHaveValue('Newer retained draft.');expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({body:'Newer retained draft.',selection:expect.objectContaining({quote:'opens'})}),expect.anything())
    expect(start).not.toHaveBeenCalled()
})
