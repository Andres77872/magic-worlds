import { act,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,expect,it,vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorView } from '@tiptap/pm/view'
import { manuscript } from '@/test/fixtures/story'
import { captureLinkTarget } from '../manuscriptLinks'
import { ManuscriptIdentity } from '../extensions/manuscriptIdentity'
import { ManuscriptLinkDialog } from './ManuscriptLinkDialog'
const editors:Editor[]=[]
afterEach(()=>{editors.forEach((editor)=>{if(!editor.isDestroyed)editor.destroy()});editors.length=0;vi.restoreAllMocks();vi.unstubAllGlobals()})
function create(){
    vi.spyOn(EditorView.prototype as unknown as {scrollToSelection:()=>void},'scrollToSelection').mockImplementation(()=>{})
    const editor=new Editor({element:document.createElement('div'),extensions:[StarterKit,ManuscriptIdentity],content:manuscript('A selected passage.').content});editors.push(editor);editor.commands.setTextSelection({from:3,to:11});return editor
}
it('applies to the captured passage and uses safe native links for explicit opening',()=>{
    const editor=create(),onClose=vi.fn();render(<ManuscriptLinkDialog target={captureLinkTarget(editor)!} editor={editor} readOnly={false} blocked={false} canWrite={()=>true} onClose={onClose}/>)
    fireEvent.change(screen.getByLabelText('Destination URL'),{target:{value:'https://example.com/paper'}})
    expect(screen.getByRole('link',{name:'Open destination'})).toHaveAttribute('rel','noopener noreferrer')
    fireEvent.click(screen.getByRole('button',{name:'Apply link'}));expect(onClose).toHaveBeenCalledOnce()
    expect(editor.getText()).toBe('A selected passage.');expect(editor.getHTML()).toContain('href="https://example.com/paper"')
})
it('retains the entered URL and blocks a changed document rather than retargeting',()=>{
    const editor=create(),before=editor.state.doc;render(<ManuscriptLinkDialog target={captureLinkTarget(editor)!} editor={editor} readOnly={false} blocked={false} canWrite={()=>true} onClose={()=>{}}/>)
    fireEvent.change(screen.getByLabelText('Destination URL'),{target:{value:'https://example.com/paper'}})
    act(()=>{editor.commands.insertContent('Later')})
    expect(editor.state.doc).not.toBe(before);expect(screen.getByRole('button',{name:'Apply link'})).toBeDisabled();expect(screen.getByLabelText('Destination URL')).toHaveValue('https://example.com/paper')
    expect(screen.getByRole('alert')).toHaveTextContent('The passage changed')
})
it('checks the live review guard and never applies a link in a reader',()=>{
    const editor=create(),onClose=vi.fn(),target=captureLinkTarget(editor)!
    const view=render(<ManuscriptLinkDialog target={target} editor={editor} readOnly={false} blocked={false} canWrite={()=>false} onClose={onClose}/>)
    fireEvent.change(screen.getByLabelText('Destination URL'),{target:{value:'https://example.com'}});fireEvent.click(screen.getByRole('button',{name:'Apply link'}));expect(editor.getHTML()).not.toContain('href=');expect(onClose).not.toHaveBeenCalled()
    view.rerender(<ManuscriptLinkDialog target={target} editor={editor} readOnly blocked={false} canWrite={()=>true} onClose={onClose}/> )
    expect(screen.queryByRole('button',{name:'Apply link'})).toBeNull();expect(screen.getByLabelText('Destination URL')).toHaveAttribute('readonly')
})
it('retires a destroyed editor while retaining the entered destination for copying',()=>{
    const editor=create();render(<ManuscriptLinkDialog target={captureLinkTarget(editor)!} editor={editor} readOnly={false} blocked={false} canWrite={()=>true} onClose={()=>{}}/> )
    fireEvent.change(screen.getByLabelText('Destination URL'),{target:{value:'https://example.com/retained'}})
    act(()=>{editor.destroy()})
    expect(screen.getByRole('button',{name:'Apply link'})).toBeDisabled();expect(screen.getByLabelText('Destination URL')).toHaveValue('https://example.com/retained')
})
