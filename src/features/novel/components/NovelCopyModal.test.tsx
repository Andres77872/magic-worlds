import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach,expect,it,vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { copyAck,copyPreview } from '@/test/fixtures/storyCopy'
import type { NovelCopies } from '../hooks/useNovelCopies'
import { NovelCopyModal } from './NovelCopyModal'

const preview=vi.fn(),start=vi.fn(),closed=vi.fn(),copied=vi.fn()
const copies=()=>({items:[],error:null,preview,start,hasPending:()=>false,busy:()=>false,retry:vi.fn(),open:vi.fn(),dismiss:vi.fn()}) as NovelCopies
const show=()=>render(<I18nextProvider i18n={i18n}><NovelCopyModal source={{id:'story-1',title:'The gate'}} copies={copies()} onClose={closed} onCopied={copied}/></I18nextProvider>)
beforeEach(async()=>{vi.resetAllMocks();preview.mockResolvedValue(copyPreview());start.mockResolvedValue(copyAck());await i18n.changeLanguage('en')})

it('reviews explicit copy options and sends only the displayed source version',async()=>{
    show()
    await screen.findByText('Parts: 0 · chapters: 1 · scenes: 1 · Codex snapshots: 1')
    fireEvent.change(screen.getByRole('textbox',{name:'Title for the new draft'}),{target:{value:'Independent draft'}})
    fireEvent.click(screen.getByRole('switch',{name:'Include author notes'}))
    fireEvent.click(screen.getByRole('switch',{name:'Include Codex context'}))
    await screen.findByText('Parts: 0 · chapters: 1 · scenes: 1 · Codex snapshots: 0')
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}))
    await waitFor(()=>expect(start).toHaveBeenCalledTimes(1))
    expect(start.mock.calls[0][1]).toMatchObject({expectedSourceVersion:'a'.repeat(64),title:'Independent draft',options:{includeNotes:false,includeContext:false,includeArchived:false,includeTrash:false}})
    expect(copied).toHaveBeenCalledTimes(1);expect(closed).toHaveBeenCalledTimes(1)
})

it('reviews personal-note counts and freezes the annotation source head with the explicit inclusion choice',async()=>{
    preview.mockResolvedValue(copyPreview(true));show()
    await screen.findByText('Personal review notes: 3')
    fireEvent.click(screen.getByRole('switch',{name:'Include items in Trash'}));expect(screen.getByText('Personal review notes: 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include personal review notes'}));expect(screen.getByText('Personal review notes: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}));await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start.mock.calls[0][1]).toMatchObject({includeComments:false,sourceAnnotationRevision:5,options:{includeTrash:true}})
})

it('reviews bookmark counts independently and freezes both explicit copy choices against the same collection head',async()=>{
    const value=copyPreview(true);value.variants=value.variants.map((variant)=>({...variant,bookmarks:variant.includeTrash?3:2}));preview.mockResolvedValue(value);show()
    await screen.findByText('Bookmarks to copy: 0')
    expect(screen.getByRole('switch',{name:'Include bookmarks'})).not.toBeChecked()
    fireEvent.click(screen.getByRole('switch',{name:'Include bookmarks'}));expect(screen.getByText('Bookmarks to copy: 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include personal review notes'}));expect(screen.getByText('Personal review notes: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}));await waitFor(()=>expect(start).toHaveBeenCalledOnce())
    expect(start.mock.calls[0][1]).toMatchObject({includeComments:false,includeBookmarks:true,sourceAnnotationRevision:5})
})

it('requires an explicit fresh preview after the source changes',async()=>{
    start.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_COPY_SOURCE_CHANGED'}))
    show();await screen.findByText('Parts: 0 · chapters: 1 · scenes: 1 · Codex snapshots: 1')
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}))
    await screen.findByText('The source changed after the preview. Review its latest saved version before creating the copy.')
    expect(screen.getByRole('button',{name:'Create independent draft'})).toBeDisabled()
    expect(start).toHaveBeenCalledTimes(1)
    preview.mockResolvedValue({...copyPreview(),sourceVersion:'b'.repeat(64)})
    fireEvent.click(screen.getByRole('button',{name:'Refresh source preview'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Create independent draft'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}))
    await waitFor(()=>expect(start).toHaveBeenCalledTimes(2))
    expect(start.mock.calls[1][1].expectedSourceVersion).toBe('b'.repeat(64))
    expect(start.mock.calls[1][1].requestId).not.toBe(start.mock.calls[0][1].requestId)
})

it('does not create or navigate after a blocked draft barrier or a closed dialog',async()=>{
    preview.mockResolvedValueOnce(null)
    const blocked=show()
    await screen.findByText('Finish the AI preview and save the scene, then refresh this preview.')
    expect(screen.getByRole('button',{name:'Create independent draft'})).toBeDisabled()
    expect(start).not.toHaveBeenCalled();blocked.unmount()
    let finish!:(value:ReturnType<typeof copyAck>)=>void
    start.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const pending=show();await screen.findByText('Parts: 0 · chapters: 1 · scenes: 1 · Codex snapshots: 1')
    fireEvent.click(screen.getByRole('button',{name:'Create independent draft'}));pending.unmount()
    await act(async()=>finish(copyAck()))
    expect(copied).not.toHaveBeenCalled();expect(closed).not.toHaveBeenCalled()
})
