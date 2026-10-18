import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach,expect,it,vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { eraseAck,eraseWrite } from '@/test/fixtures/storyErase'
import type { NovelErases } from '../hooks/useNovelErases'
import { NovelPendingErases } from './NovelPendingErases'

const check=vi.fn(),retry=vi.fn(),resolved=vi.fn()
const controller=(change:Partial<NovelErases>={}):NovelErases=>({scopeKey:'author-one',readOnly:false,items:[{schema:1,write:{storyId:'story-1',write:eraseWrite()}}],error:null,
    check,retry,preview:vi.fn(),start:vi.fn(),hasPending:()=>true,busy:()=>false,isErased:()=>false,...change})
const ui=(erases:NovelErases)=><I18nextProvider i18n={i18n}><NovelPendingErases erases={erases} onResolved={resolved}/></I18nextProvider>
beforeEach(async()=>{vi.resetAllMocks();await i18n.changeLanguage('en');check.mockResolvedValue(null);retry.mockResolvedValue(eraseAck())})

it('offers a read first, then an explicit retry only after a missing result was checked',async()=>{
    const erases=controller(),view=render(ui(erases))
    expect(screen.queryByRole('button',{name:'Retry confirmed erase'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Check result'}));await waitFor(()=>expect(check).toHaveBeenCalledTimes(1))
    expect(retry).not.toHaveBeenCalled();expect(resolved).not.toHaveBeenCalled()
    view.rerender(ui(controller({items:[{...erases.items[0],checkedMissing:true}]})))
    fireEvent.click(screen.getByRole('button',{name:'Retry confirmed erase'}));await waitFor(()=>expect(retry).toHaveBeenCalledTimes(1));expect(resolved).toHaveBeenCalledTimes(1)
})

it('keeps archived result checks available without enabling destructive retries',async()=>{
    check.mockResolvedValue(eraseAck());const erases=controller({readOnly:true});erases.items[0].checkedMissing=true;render(ui(erases))
    expect(screen.getByRole('button',{name:'Retry confirmed erase'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Check result'}));await waitFor(()=>expect(resolved).toHaveBeenCalledTimes(1));expect(retry).not.toHaveBeenCalled()
})

it('shows copyable recovery information while keeping an uncertain operation intact',()=>{
    const erases=controller();erases.items[0].storageFailed=true;render(ui(erases))
    expect(screen.getByText(/Recovery could not be saved on this device/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Show recovery details'}))
    const information=screen.getByRole('textbox',{name:'Erasure recovery information'})
    expect(information).toHaveAttribute('readonly');expect(JSON.parse((information as HTMLTextAreaElement).value)).toEqual(erases.items[0].write)
    expect(screen.queryByRole('button',{name:/dismiss|discard/i})).not.toBeInTheDocument()
})

it('does not carry a busy state or result callback into another owner',async()=>{
    let finish!:(value:ReturnType<typeof eraseAck>)=>void;check.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=render(ui(controller()));fireEvent.click(screen.getByRole('button',{name:'Check result'}))
    view.rerender(ui(controller({scopeKey:'another-owner'})))
    expect(screen.getByRole('button',{name:'Check result'})).toBeEnabled()
    await act(async()=>finish(eraseAck()));expect(resolved).not.toHaveBeenCalled()
})
