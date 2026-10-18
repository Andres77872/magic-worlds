import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { manuscript } from '@/test/fixtures/story'
import { currentRevisionScene,revisionHead,revisionPage,revisionSummary,sceneRevision,sceneRestoreAck } from '@/test/fixtures/storyRevisions'
import type { SceneRevisionSource } from '../hooks/useSceneRevisionSource'
import type { SceneRestoreIntent } from '../persistence/sceneRestoreJournal'
import { NovelRevisionDrawer } from './NovelRevisionDrawer'

const download=vi.hoisted(()=>vi.fn())
vi.mock('@/utils/download',async(importOriginal)=>({...await importOriginal<typeof import('@/utils/download')>(),downloadBlob:download}))
const before=vi.fn(),start=vi.fn(),clipboard=vi.fn(),clearError=vi.fn()
let source:SceneRevisionSource
const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard')
const props=()=>({open:true,onClose:vi.fn(),source,readOnly:false,beforeWrite:before,restores:{items:[],error:null,start,recover:vi.fn(),hasPending:()=>false,busy:()=>false,clearError}})
const choose=async()=>{fireEvent.click(await screen.findByRole('button',{name:'Revision 2 · Saved draft'}));return screen.findByRole('region',{name:'Scene revision comparison'})}
const prepare=async()=>{await choose();fireEvent.click(screen.getByRole('button',{name:'Review scene restore'}));return screen.findByRole('dialog',{name:'Review scene text restore'})}
beforeEach(()=>{
    vi.clearAllMocks();before.mockResolvedValue(true);start.mockImplementation(async(request:SceneRestoreIntent)=>sceneRestoreAck(request.write));clipboard.mockResolvedValue(undefined)
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:clipboard}})
    source={key:'author:work-one:story-1:scene-1',storyId:'story-1',sceneId:'scene-1',isCurrent:()=>true,page:vi.fn().mockResolvedValue(revisionPage()),detail:vi.fn().mockResolvedValue(sceneRevision()),current:vi.fn().mockResolvedValue(currentRevisionScene()),head:vi.fn().mockResolvedValue(revisionHead())}
})
afterEach(()=>{if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else Reflect.deleteProperty(navigator,'clipboard')})
it('lists metadata first and loads original and current saved text only on selection',async()=>{
    render(<NovelRevisionDrawer {...props()}/>);await screen.findByRole('button',{name:'Revision 2 · Saved draft'})
    expect(source.detail).not.toHaveBeenCalled();expect(source.current).not.toHaveBeenCalled()
    const comparison=await choose()
    expect(source.detail).toHaveBeenCalledWith(2,'b'.repeat(64));expect(source.current).toHaveBeenCalledOnce()
    expect(within(comparison).getByText('The old gate glows. 🌒 Mira waits.')).toBeInTheDocument()
    expect(within(comparison).getByText('The gate opens to the sea.')).toBeInTheDocument()
    expect(before).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled()
})
it('requires both save/review barriers and one exact hash-bound restore after deliberate confirmation',async()=>{
    before.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true)
    render(<NovelRevisionDrawer {...props()}/>);await choose()
    fireEvent.click(screen.getByRole('button',{name:'Review scene restore'}));await screen.findByRole('alert')
    expect(screen.queryByRole('dialog',{name:'Review scene text restore'})).not.toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review scene restore'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Review scene restore'}))
    const review=await screen.findByRole('dialog',{name:'Review scene text restore'})
    expect(within(review).getByText('The gate opens to the sea.')).toBeInTheDocument();expect(within(review).getByText('The old gate glows. 🌒 Mira waits.')).toBeInTheDocument()
    fireEvent.click(within(review).getByRole('button',{name:'Restore as a new revision'}));await within(review).findByRole('alert')
    expect(start).not.toHaveBeenCalled();expect(source.head).not.toHaveBeenCalled()
    await waitFor(()=>expect(within(review).getByRole('button',{name:'Restore as a new revision'})).toBeEnabled())
    fireEvent.click(within(review).getByRole('button',{name:'Restore as a new revision'}));fireEvent.click(within(review).getByRole('button',{name:'Restore as a new revision'}))
    await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start).toHaveBeenCalledWith({storyId:'story-1',sceneId:'scene-1',sceneTitle:'At the gate',revision:2,write:{requestId:expect.any(String),expectedRevision:3,expectedContentHash:'c'.repeat(64),sourceContentHash:'b'.repeat(64)}})
    expect(before).toHaveBeenCalledTimes(4)
    expect(await screen.findByText('Scene text restored as revision 4 from revision 2.')).toBeInTheDocument()
})
it('rechecks a lightweight head before applying and requires explicit refreshed review after new prose',async()=>{
    source.head=vi.fn().mockResolvedValueOnce(revisionHead({revision:4,contentHash:'d'.repeat(64)})).mockResolvedValue(revisionHead())
    render(<NovelRevisionDrawer {...props()}/>);const review=await prepare()
    fireEvent.click(within(review).getByRole('button',{name:'Restore as a new revision'}))
    const refresh=await within(review).findByRole('button',{name:'Refresh restore review'})
    expect(start).not.toHaveBeenCalled();expect(within(review).queryByRole('button',{name:'Restore as a new revision'})).not.toBeInTheDocument()
    await waitFor(()=>expect(refresh).toBeEnabled());fireEvent.click(refresh)
    await within(review).findByRole('button',{name:'Restore as a new revision'})
    expect(source.current).toHaveBeenCalledTimes(3);expect(start).not.toHaveBeenCalled()
})
it('blocks stale server rejection until a refreshed review and retains pending restore errors',async()=>{
    start.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_REVISION_SOURCE_CHANGED'}))
    render(<NovelRevisionDrawer {...props()}/>);const review=await prepare()
    fireEvent.click(within(review).getByRole('button',{name:'Restore as a new revision'}))
    expect(await within(review).findByRole('button',{name:'Refresh restore review'})).toBeInTheDocument()
    expect(start).toHaveBeenCalledOnce()
})
it('keeps archived history readable and copyable while disabling restore',async()=>{
    render(<NovelRevisionDrawer {...props()} readOnly/>);await choose()
    expect(screen.getByRole('button',{name:'Review scene restore'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Copy checkpoint Markdown'}))
    await waitFor(()=>expect(clipboard).toHaveBeenCalledWith(sceneRevision().body))
    expect(start).not.toHaveBeenCalled();expect(before).not.toHaveBeenCalled()
})
it('uses source/actor/date selectors and prevents inverted date ranges without another read',async()=>{
    render(<NovelRevisionDrawer {...props()}/>);await screen.findByRole('button',{name:'Revision 2 · Saved draft'})
    fireEvent.click(screen.getByRole('combobox',{name:'Source'}));fireEvent.click(screen.getByRole('option',{name:'Accepted suggestion'}))
    await waitFor(()=>expect(source.page).toHaveBeenLastCalledWith({source:'ai'}))
    fireEvent.click(screen.getByRole('combobox',{name:'Recorded by'}));fireEvent.click(screen.getByRole('option',{name:'System'}))
    await waitFor(()=>expect(source.page).toHaveBeenLastCalledWith({source:'ai',actor:'system'}))
    fireEvent.change(screen.getByLabelText('From recorded date'),{target:{value:'2026-10-16'}})
    await waitFor(()=>expect(source.page).toHaveBeenLastCalledWith({source:'ai',actor:'system',fromDate:'2026-10-16'}))
    const count=vi.mocked(source.page).mock.calls.length
    fireEvent.change(screen.getByLabelText('Through recorded date'),{target:{value:'2026-10-15'}})
    expect(await screen.findByText('Choose an end date on or after the start date.')).toBeInTheDocument();expect(source.page).toHaveBeenCalledTimes(count)
})
it('keeps earlier loaded summaries after pagination fails and retries with the same cursor',async()=>{
    source.page=vi.fn().mockResolvedValueOnce(revisionPage({nextBefore:2})).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(revisionPage({items:[revisionSummary({revision:1,parentRevision:null,source:'initial'})]}))
    render(<NovelRevisionDrawer {...props()}/>);fireEvent.click(await screen.findByRole('button',{name:'Load earlier revisions'}))
    await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Revision 2 · Saved draft'})).toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Load earlier revisions'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Load earlier revisions'}))
    expect(await screen.findByRole('button',{name:'Revision 1 · Initial draft'})).toBeInTheDocument();expect(source.page).toHaveBeenLastCalledWith({before:2})
})
it('offers selected Unicode plain text and a download fallback when the clipboard is unavailable',async()=>{
    source.detail=vi.fn().mockResolvedValue(sceneRevision({document:manuscript('A🌒B','emoji-block')}));clipboard.mockRejectedValueOnce(new Error('Unavailable'))
    render(<NovelRevisionDrawer {...props()} readOnly/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Select an excerpt'}))
    const text=screen.getByRole('textbox',{name:'Select the plain-text excerpt to copy'}) as HTMLTextAreaElement
    text.setSelectionRange(2,3);fireEvent.select(text)
    fireEvent.click(screen.getByRole('button',{name:'Copy selected text'}))
    expect(await screen.findByText('The clipboard is unavailable. Use Download to keep the selected text.')).toBeInTheDocument()
    expect(clipboard).toHaveBeenCalledWith('🌒')
    fireEvent.click(screen.getByRole('button',{name:'Download selected text'}))
    expect(download).toHaveBeenCalledWith(expect.any(Blob),'At-the-gate-revision-2.txt')
    expect(download.mock.calls[0][0].size).toBe(4)
    text.setSelectionRange(1,1);fireEvent.select(text);expect(screen.getByRole('button',{name:'Copy selected text'})).toBeDisabled()
})
it('never copies or downloads from an old account scope and ignores a late clipboard completion',async()=>{
    let current=true,finish!:()=>void
    source.isCurrent=()=>current;clipboard.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    render(<NovelRevisionDrawer {...props()}/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Copy checkpoint Markdown'}))
    current=false;await act(async()=>{finish()})
    expect(screen.queryByText('Copied.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Copy checkpoint Markdown'}));fireEvent.click(screen.getByRole('button',{name:'Download checkpoint Markdown'}))
    expect(clipboard).toHaveBeenCalledTimes(1);expect(download).not.toHaveBeenCalled()
})
it('does not label another checkpoint as copied when a previous clipboard request finishes',async()=>{
    let finish!:()=>void
    clipboard.mockImplementationOnce(()=>new Promise<void>((resolve)=>{finish=resolve}))
    source.page=vi.fn().mockResolvedValue(revisionPage({items:[revisionSummary(),revisionSummary({revision:1,parentRevision:null,source:'initial'})]}))
    source.detail=vi.fn(async(revision)=>sceneRevision({revision,parentRevision:revision===1?null:1,document:manuscript(revision===1?'Earliest draft.':'Later draft.','prose-'+revision)}))
    render(<NovelRevisionDrawer {...props()}/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Copy checkpoint Markdown'}))
    fireEvent.click(screen.getByRole('button',{name:'Revision 1 · Initial draft'}));await screen.findByText('Earliest draft.')
    await act(async()=>finish());expect(screen.queryByText('Copied.')).not.toBeInTheDocument()
})
it('ignores a late detail read after the account/scene source changes',async()=>{
    let finish!:(value:ReturnType<typeof sceneRevision>)=>void
    source.detail=vi.fn(()=>new Promise<ReturnType<typeof sceneRevision>>((resolve)=>{finish=resolve}))
    const p=props(),view=render(<NovelRevisionDrawer {...p}/>);fireEvent.click(await screen.findByRole('button',{name:'Revision 2 · Saved draft'}))
    const replacement={...source,key:'other-author:work-two:story-two:scene-two',storyId:'story-two',sceneId:'scene-two',page:vi.fn().mockResolvedValue(revisionPage({storyId:'story-two',sceneId:'scene-two',items:[]}))}
    view.rerender(<NovelRevisionDrawer {...p} source={replacement}/>)
    await act(async()=>{finish(sceneRevision())})
    expect(screen.queryByRole('region',{name:'Scene revision comparison'})).not.toBeInTheDocument();expect(start).not.toHaveBeenCalled()
})
it('retains unsupported checkpoint metadata and never prepares its content for writing',async()=>{
    source.page=vi.fn().mockResolvedValue(revisionPage({items:[revisionSummary({schemaVersion:2})]}));source.detail=vi.fn().mockRejectedValue(new ApiError(409,'Unsupported',{code:'STORY_DOCUMENT_FORMAT_UNSUPPORTED'}))
    render(<NovelRevisionDrawer {...props()}/>);fireEvent.click(await screen.findByRole('button',{name:'Revision 2 · Saved draft'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('unsupported format');expect(start).not.toHaveBeenCalled();expect(before).not.toHaveBeenCalled()
})
