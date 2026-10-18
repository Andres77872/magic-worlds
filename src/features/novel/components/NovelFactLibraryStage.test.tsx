import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { planItem } from '@/test/fixtures/planItems'
import type { StoryCodexLibraryDraft } from '@/shared'
import { NovelFactLibraryStage,type FactLibrary } from './NovelFactLibraryStage'

const fact=planItem('fact',{subject:'Mara',kind:'trait',statement:'Keeps the lamp at Gull Point.',sourceSceneId:'s1',quote:'Mara kept the lamp',sourceRevision:6,origin:'assistant',codexRefId:'ref-mara',codexRevision:4},{state:'approved'})
const entry={id:'ref-mara',label:'Mara',kind:'character' as const,description:'A lighthouse keeper.\n\nKeeps the lamp at Gull Point.',sourceId:'card-1'}
const draft=(description:string,patch:Partial<StoryCodexLibraryDraft>={}):StoryCodexLibraryDraft=>({refId:'ref-mara',basis:'published',description,stamp:'a'.repeat(64),versionNumber:3,...patch})

it('stages the reviewed text in the library card draft against the reviewed content and says publishing stays in the card editor',async()=>{
    const library:FactLibrary={linked:()=>true,read:vi.fn().mockResolvedValueOnce(draft('A lighthouse keeper.')).mockResolvedValueOnce(draft('Edited in the editor.',{basis:'draft',stamp:'b'.repeat(64)})),
        stage:vi.fn().mockRejectedValueOnce(new ApiError(409,'changed',{code:'STORY_LIBRARY_DRAFT_CHANGED'})).mockResolvedValueOnce(draft('Edited in the editor.\n\nKeeps the lamp at Gull Point.',{basis:'draft',stamp:'c'.repeat(64)}))}
    render(<NovelFactLibraryStage fact={fact} entry={entry} library={library} onClose={vi.fn()}/>)
    expect(screen.getByText(/private draft of the library card Mara/)).toBeInTheDocument()
    expect(await screen.findByText('Starting from the published card (version 3). A draft will be created.')).toBeInTheDocument()
    const after=screen.getByRole('textbox',{name:'Library description in the draft'})
    expect(after).toHaveValue('A lighthouse keeper.\n\nKeeps the lamp at Gull Point.')
    fireEvent.click(screen.getByRole('button',{name:'Save to the card’s draft'}))
    expect(await screen.findByText(/The card’s draft changed in the card editor/)).toBeInTheDocument()
    expect(library.stage).toHaveBeenCalledWith('ref-mara','A lighthouse keeper.\n\nKeeps the lamp at Gull Point.','a'.repeat(64))
    // The newer draft is shown and the proposal starts again from it.
    expect(await screen.findByText('Starting from the card’s unpublished draft.')).toBeInTheDocument()
    expect(screen.getByRole('textbox',{name:'Library description in the draft'})).toHaveValue('Edited in the editor.\n\nKeeps the lamp at Gull Point.')
    fireEvent.click(screen.getByRole('button',{name:'Save to the card’s draft'}))
    await waitFor(()=>expect(library.stage).toHaveBeenLastCalledWith('ref-mara','Edited in the editor.\n\nKeeps the lamp at Gull Point.','b'.repeat(64)))
    expect(await screen.findByText('Saved to the draft of Mara. Publish it from the card editor when you are ready.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Save to the card’s draft'})).not.toBeInTheDocument()
})

it('offers nothing to save when the library card already holds the statement or is gone',async()=>{
    const library:FactLibrary={linked:()=>true,read:vi.fn().mockResolvedValue(draft('A keeper. Keeps the lamp   at Gull Point.')),stage:vi.fn()}
    const view=render(<NovelFactLibraryStage fact={fact} entry={entry} library={library} onClose={vi.fn()}/>)
    expect(await screen.findByText('The library card already holds this statement.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save to the card’s draft'})).toBeDisabled()
    view.unmount()
    const gone:FactLibrary={linked:()=>true,read:vi.fn().mockRejectedValue(new ApiError(404,'gone',{code:'STORY_CODEX_SOURCE_MISSING'})),stage:vi.fn()}
    render(<NovelFactLibraryStage fact={fact} entry={entry} library={gone} onClose={vi.fn()}/>)
    expect(await screen.findByText('The library card is gone or is in another workspace.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save to the card’s draft'})).toBeDisabled()
    expect(gone.stage).not.toHaveBeenCalled()
})

it('writes a fact into the library lorebook entry itself after saying it applies at once, refusing an entry saved meanwhile',async()=>{
    const bell=planItem('fact',{subject:'The Tide Bell',kind:'knowledge',statement:'It rings once for a boat coming home.',origin:'author',codexRefId:'ref-bell',codexRevision:5},{state:'approved'})
    const lore={id:'ref-bell',label:'The Tide Bell',kind:'lorebook_entry' as const,description:'A brass bell.\n\nIt rings once for a boat coming home.',sourceId:'entry-1'}
    const stored=(content:string,stamp:string)=>({refId:'ref-bell',lorebookId:'book-1',entryId:'entry-1',title:'The Tide Bell',content,stamp})
    const library:FactLibrary={linked:()=>false,read:vi.fn(),stage:vi.fn(),lorebook:{linked:()=>true,
        read:vi.fn().mockResolvedValueOnce(stored('A brass bell.','a'.repeat(64))).mockResolvedValueOnce(stored('A brass bell under the pier.','b'.repeat(64))),
        write:vi.fn().mockRejectedValueOnce(new ApiError(409,'changed',{code:'STORY_LIBRARY_ENTRY_CHANGED'})).mockResolvedValueOnce(stored('A brass bell under the pier.\n\nIt rings once for a boat coming home.','c'.repeat(64)))}}
    render(<NovelFactLibraryStage fact={bell} entry={lore} library={library} onClose={vi.fn()}/>)
    expect(screen.getByRole('dialog',{name:'Write a fact to the library lorebook entry'})).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/changes the lorebook entry The Tide Bell in your library now. Lorebook entries have no draft/)
    expect(await screen.findByText('Starting from the lorebook entry as saved now.')).toBeInTheDocument()
    expect(screen.getByRole('textbox',{name:'Lorebook entry text after writing'})).toHaveValue('A brass bell.\n\nIt rings once for a boat coming home.')
    fireEvent.click(screen.getByRole('button',{name:'Write to the lorebook entry'}))
    expect(await screen.findByText(/saved in the Lorebook Studio since you opened this review/)).toBeInTheDocument()
    expect(library.lorebook!.write).toHaveBeenCalledWith('ref-bell','A brass bell.\n\nIt rings once for a boat coming home.','a'.repeat(64))
    await waitFor(()=>expect(screen.getByRole('textbox',{name:'Lorebook entry text after writing'})).toHaveValue('A brass bell under the pier.\n\nIt rings once for a boat coming home.'))
    fireEvent.click(screen.getByRole('button',{name:'Write to the lorebook entry'}))
    await waitFor(()=>expect(library.lorebook!.write).toHaveBeenLastCalledWith('ref-bell','A brass bell under the pier.\n\nIt rings once for a boat coming home.','b'.repeat(64)))
    expect(await screen.findByText(/Written to the lorebook entry The Tide Bell/)).toBeInTheDocument()
    expect(library.read).not.toHaveBeenCalled()
    expect(library.stage).not.toHaveBeenCalled()
})
