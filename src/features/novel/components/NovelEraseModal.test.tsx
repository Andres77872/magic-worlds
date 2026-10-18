import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach,expect,it,vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { eraseAck,erasePreview } from '@/test/fixtures/storyErase'
import type { NovelErases } from '../hooks/useNovelErases'
import { NovelEraseModal } from './NovelEraseModal'

const preview=vi.fn(),start=vi.fn(),closed=vi.fn(),erased=vi.fn()
const controller=(changes:Partial<NovelErases>={}):NovelErases=>({scopeKey:'author-one',items:[],error:null,readOnly:false,preview,start,check:vi.fn(),retry:vi.fn(),hasPending:()=>false,busy:()=>false,isErased:()=>false,...changes})
const show=(erases=controller())=>render(<I18nextProvider i18n={i18n}><NovelEraseModal source={{id:'story-1',title:'The closed door'}} erases={erases} onClose={closed} onErased={erased}/></I18nextProvider>)
beforeEach(async()=>{vi.resetAllMocks();await i18n.changeLanguage('en');preview.mockResolvedValue(erasePreview());start.mockImplementation(async(_preview,write)=>eraseAck(write))})

it('requires the exact reviewed title and discloses descendants and retained sources',async()=>{
    show();const action=screen.getByRole('button',{name:'Erase permanently'})
    expect(action).toBeDisabled();await screen.findByText('Parts: 0 · chapters: 1 · scenes: 2')
    expect(screen.getByText('Authored suggestion versions: 2')).toBeInTheDocument()
    expect(screen.getByText(/Source cards, shared images and audio/)).toBeInTheDocument()
    expect(screen.getByText(/Drafts on this device remain/)).toBeInTheDocument()
    const name=screen.getByRole('textbox',{name:'Type the novel’s exact title'})
    fireEvent.change(name,{target:{value:'The closed door '}});expect(action).toBeDisabled()
    fireEvent.change(name,{target:{value:'The closed door'}});expect(action).toBeEnabled()
    fireEvent.click(action);await waitFor(()=>expect(start).toHaveBeenCalledTimes(1))
    expect(start.mock.calls[0][1]).toMatchObject({expectedSourceVersion:'a'.repeat(64),confirmedTitle:'The closed door',requestId:expect.any(String)})
    expect(erased).toHaveBeenCalledTimes(1);expect(closed).toHaveBeenCalledTimes(1)
})

it('requires a fresh review and fresh confirmation after a source refusal',async()=>{
    start.mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_ERASE_SOURCE_CHANGED'}));show()
    await screen.findByText('Parts: 0 · chapters: 1 · scenes: 2')
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'The closed door'}})
    fireEvent.click(screen.getByRole('button',{name:'Erase permanently'}))
    await screen.findByText('The novel changed or is no longer in Trash. Refresh the review and confirm its title again.')
    expect(screen.getByRole('button',{name:'Erase permanently'})).toBeDisabled()
    preview.mockResolvedValue(erasePreview({sourceVersion:'c'.repeat(64)}));fireEvent.click(screen.getByRole('button',{name:'Refresh erasure review'}))
    await waitFor(()=>expect(preview).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''))
    expect(screen.getByRole('button',{name:'Erase permanently'})).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'The closed door'}});fireEvent.click(screen.getByRole('button',{name:'Erase permanently'}))
    await waitFor(()=>expect(start).toHaveBeenCalledTimes(2));expect(start.mock.calls[1][1].expectedSourceVersion).toBe('c'.repeat(64))
    expect(start.mock.calls[1][1].requestId).not.toBe(start.mock.calls[0][1].requestId)
})

it('blocks active generation, archived workspaces and a pending earlier erase',async()=>{
    preview.mockResolvedValue(erasePreview({activeExecutions:1}));const active=show()
    await screen.findByText('Wait for or stop active AI generation, then refresh this review.')
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'The closed door'}});expect(screen.getByRole('button',{name:'Erase permanently'})).toBeDisabled();active.unmount()
    preview.mockResolvedValue(erasePreview());const archived=show(controller({readOnly:true}))
    await screen.findByText('This workspace is read-only. You can check a saved result, but cannot start or retry an erase.')
    expect(screen.getByRole('textbox')).toBeDisabled();archived.unmount()
    show(controller({hasPending:()=>true}));await screen.findByText('A permanent erase was confirmed. Check its saved result before another action.')
    expect(screen.getByRole('button',{name:'Erase permanently'})).toBeDisabled();expect(start).not.toHaveBeenCalled()
})

it('keeps the close action honest and ignores a result after the dialog closes',async()=>{
    let finish!:(value:ReturnType<typeof eraseAck>)=>void
    start.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=show();await screen.findByText('Parts: 0 · chapters: 1 · scenes: 2')
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'The closed door'}});fireEvent.click(screen.getByRole('button',{name:'Erase permanently'}))
    expect(screen.getByText(/Closing this dialog does not cancel/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button',{name:'Close'}).slice(-1)[0]);expect(closed).toHaveBeenCalledTimes(1);view.unmount()
    await act(async()=>finish(eraseAck()));expect(erased).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledTimes(1)
})

it('permits confirmation of a 255-codepoint title without truncating surrogate pairs',async()=>{
    const title='🙂'.repeat(255);preview.mockResolvedValue(erasePreview({title}));show()
    await screen.findByText('Parts: 0 · chapters: 1 · scenes: 2')
    const input=screen.getByRole('textbox');expect(input).toHaveAttribute('maxlength','510')
    fireEvent.change(input,{target:{value:title}});expect(screen.getByRole('button',{name:'Erase permanently'})).toBeEnabled()
})

it('provides the same explicit confirmation in Spanish',async()=>{
    await i18n.changeLanguage('es');show();await screen.findByText('Partes: 0 · capítulos: 1 · escenas: 2')
    fireEvent.change(screen.getByRole('textbox',{name:'Escribe el título exacto de la novela'}),{target:{value:'The closed door'}})
    expect(screen.getByRole('button',{name:'Borrar definitivamente'})).toBeEnabled()
})
