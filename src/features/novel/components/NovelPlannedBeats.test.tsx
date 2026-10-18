import { useState } from 'react'
import { fireEvent,render,screen } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { NovelPlannedBeats } from './NovelPlannedBeats'

function Demo(){const [value,setValue]=useState(['Repeated','Repeated','  Mira waits.\n雨 🙂  ']);return <NovelPlannedBeats value={value} onChange={setValue}/>}
it('moves whole multiline beats, keeps duplicate row identities and permits immediate removal undo',()=>{
    render(<Demo/>);const first=screen.getByRole('textbox',{name:'Beat 1'}),last=screen.getByRole('textbox',{name:'Beat 3'})
    fireEvent.click(screen.getByRole('button',{name:'Move beat 3 up'}))
    expect(screen.getByRole('textbox',{name:'Beat 2'})).toBe(last);expect(last).toHaveFocus();expect(last).toHaveValue('  Mira waits.\n雨 🙂  ')
    expect(screen.getByRole('textbox',{name:'Beat 1'})).toBe(first)
    fireEvent.click(screen.getByRole('button',{name:'Remove beat 1'}));expect(screen.getAllByRole('textbox')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button',{name:'Undo removal'}));expect(screen.getByRole('textbox',{name:'Beat 1'})).toHaveValue('Repeated')
    fireEvent.click(screen.getByRole('button',{name:'Add beat'}));expect(screen.getByRole('textbox',{name:'Beat 4'})).toHaveValue('')
    fireEvent.change(screen.getByRole('textbox',{name:'Beat 4'}),{target:{value:'🙂'.repeat(2001)}})
    expect(screen.getByRole('textbox',{name:'Beat 4'})).toHaveValue('🙂'.repeat(2001))
    expect(screen.getByRole('textbox',{name:'Beat 4'})).toHaveAttribute('aria-invalid','true')
    expect(screen.queryByRole('button',{name:'Undo removal'})).not.toBeInTheDocument()
})
it('blocks reader changes and resets row state when an external value replaces the form',()=>{
    const change=vi.fn(),view=render(<NovelPlannedBeats value={['Old plan']} onChange={change} disabled/>)
    expect(screen.getByRole('textbox',{name:'Beat 1'})).toBeDisabled();expect(screen.getByRole('button',{name:'Add beat'})).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox',{name:'Beat 1'}),{target:{value:'Blocked'}});expect(change).not.toHaveBeenCalled()
    view.rerender(<NovelPlannedBeats value={['Account plan','Next']} onChange={change}/>)
    expect(screen.getByRole('textbox',{name:'Beat 1'})).toHaveValue('Account plan');expect(screen.getAllByRole('textbox')).toHaveLength(2)
    view.rerender(<NovelPlannedBeats value={Array(100).fill('Plan')} onChange={change}/>)
    expect(screen.getByRole('button',{name:'Add beat'})).toBeDisabled()
})
