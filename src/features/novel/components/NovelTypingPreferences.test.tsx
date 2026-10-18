import { fireEvent,render,screen } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { DEFAULT_TYPING,PLAIN_TYPING } from '../utils/typingPreferences'
import { NovelTypingPreferences } from './NovelTypingPreferences'
it('offers a single literal-typing action and reports unavailable reopening hints',()=>{
    const onChange=vi.fn(),onClose=vi.fn()
    render(<NovelTypingPreferences open value={DEFAULT_TYPING} onChange={onChange} onClose={onClose} storageUnavailable/> )
    expect(screen.getByRole('status')).toHaveTextContent('This browser could not retain')
    fireEvent.click(screen.getByRole('button',{name:'Keep all typing literal'}));expect(onChange).toHaveBeenCalledWith(PLAIN_TYPING)
    fireEvent.click(screen.getByRole('button',{name:'Reset typing preferences'}));expect(onChange).toHaveBeenLastCalledWith(DEFAULT_TYPING)
    fireEvent.click(screen.getByRole('button',{name:'Done'}));expect(onClose).toHaveBeenCalledOnce()
})
it('changes one replacement family without changing the remaining author choices',()=>{
    const onChange=vi.fn()
    render(<NovelTypingPreferences open value={PLAIN_TYPING} onChange={onChange} onClose={()=>{}} storageUnavailable={false}/> )
    fireEvent.click(screen.getByRole('switch',{name:'Dashes and ellipses'}));expect(onChange).toHaveBeenCalledWith({...PLAIN_TYPING,punctuation:true})
    fireEvent.click(screen.getByRole('switch',{name:'Symbols and fractions'}));expect(onChange).toHaveBeenLastCalledWith({...PLAIN_TYPING,symbols:true})
})

it('changes only the display preference when showing invisible characters and resets both preference groups explicitly',()=>{
    const typing=vi.fn(),display=vi.fn()
    render(<NovelTypingPreferences open value={PLAIN_TYPING} onChange={typing} onClose={()=>{}} storageUnavailable={false} showInvisibles onShowInvisibles={display}/>)
    const toggle=screen.getByRole('switch',{name:'Show invisible characters'})
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(display).toHaveBeenCalledWith(false);expect(typing).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Reset typing preferences'}))
    expect(typing).toHaveBeenCalledWith(DEFAULT_TYPING);expect(display).toHaveBeenLastCalledWith(false)
})
