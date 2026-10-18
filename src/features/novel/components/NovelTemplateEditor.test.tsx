import { useState } from 'react'
import { fireEvent,render,screen } from '@testing-library/react'
import { expect,it } from 'vitest'
import { NovelTemplateEditor } from './NovelTemplateEditor'
import { writingTemplate } from '../utils/writingTemplates'
import { novelTemplates } from '@/app/i18n/locales/novelTemplates'
function Demo(){const [value,setValue]=useState(()=>writingTemplate('three_acts',(key)=>novelTemplates.en[key as keyof typeof novelTemplates.en]));return <NovelTemplateEditor value={value} onChange={setValue}/>}
it('recovers an immediately removed part with its chapters and preserves later edits by retiring old removal undo',()=>{
    render(<Demo/>)
    fireEvent.click(screen.getByRole('button',{name:'Edit Part · Act I · Setup'}));fireEvent.click(screen.getByRole('button',{name:'Remove template item'}))
    expect(screen.getByText('2 parts · 3 chapters · 4 scenes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Undo removal'}))
    expect(screen.getByRole('button',{name:'Edit Part · Act I · Setup'})).toHaveAttribute('aria-current','true')
    fireEvent.click(screen.getByRole('button',{name:'Remove template item'}))
    fireEvent.change(screen.getByRole('textbox',{name:'Template item title'}),{target:{value:'A later change'}})
    expect(screen.queryByRole('button',{name:'Undo removal'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Edit Chapter · A later change'})).toBeInTheDocument()
})
it('retains a newline while entering a second plot thread',()=>{
    render(<Demo/>);const threads=screen.getByRole('textbox',{name:'Plot threads, one per line'})
    fireEvent.change(threads,{target:{value:'The gate\n'}});expect(threads).toHaveValue('The gate\n')
    fireEvent.change(threads,{target:{value:'The gate\nMira'}});fireEvent.blur(threads)
    expect(threads).toHaveValue('The gate\nMira')
})
