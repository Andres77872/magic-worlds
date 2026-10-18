import { fireEvent,render,screen,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { NovelLibraryFilters } from './NovelLibraryFilters'
function choose(field:string,option:string){fireEvent.click(screen.getByRole('combobox',{name:field}));fireEvent.click(screen.getByRole('option',{name:option}))}
it('applies reviewed filters and sort explicitly and cancels without changing the list',()=>{
    const change=vi.fn();render(<NovelLibraryFilters value={{genre:'Fantasy'}} onChange={change}/>)
    fireEvent.click(screen.getByRole('button',{name:'Filters and sort · 1'}))
    choose('Search in','Manuscript text');choose('Sort novels','Title A–Z');choose('Novel status','Revising')
    fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:'  Fantasía_100%  '}})
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
    expect(change).toHaveBeenCalledWith({genre:'Fantasía_100%',searchIn:'manuscript',sort:'title_asc',status:'revising'})
    fireEvent.click(screen.getByRole('button',{name:'Filters and sort · 1'}));fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:'A later cancelled edit'}})
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}))
    expect(change).toHaveBeenCalledTimes(1)
})
it('retains invalid input and requires valid dates before applying or allows an explicit reset',()=>{
    const change=vi.fn();render(<NovelLibraryFilters value={{}} onChange={change}/>)
    fireEvent.click(screen.getByRole('button',{name:'Filters and sort'}))
    const text='🙂'.repeat(256)
    fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:text}})
    fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
    expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.getByRole('textbox',{name:'Genre contains'})).toHaveValue(text)
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox',{name:'Genre contains'}),{target:{value:''}})
    fireEvent.change(screen.getByLabelText('Activity from'),{target:{value:'2026-10-17'}})
    fireEvent.change(screen.getByLabelText('Activity through'),{target:{value:'2026-10-16'}})
    fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));expect(change).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog',{name:'Filters and sort'})).getByRole('button',{name:'Reset filters'}))
    expect(change).toHaveBeenCalledWith({})
})

it('retains invalid word limits and applies an inclusive zero range only after review',()=>{
    const change=vi.fn();render(<NovelLibraryFilters value={{}} onChange={change}/>)
    fireEvent.click(screen.getByRole('button',{name:'Filters and sort'}))
    const minimum=screen.getByRole('textbox',{name:'Minimum saved words'}),maximum=screen.getByRole('textbox',{name:'Maximum saved words'})
    fireEvent.change(minimum,{target:{value:'1.5'}});fireEvent.change(maximum,{target:{value:'0'}})
    fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
    expect(minimum).toHaveValue('1.5');expect(change).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(minimum,{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));expect(change).not.toHaveBeenCalled()
    fireEvent.change(minimum,{target:{value:'0'}});choose('Sort novels','Fewest saved words')
    fireEvent.click(screen.getByRole('button',{name:'Apply filters'}))
    expect(change).toHaveBeenCalledWith({minWords:0,maxWords:0,sort:'words_asc'})
})
