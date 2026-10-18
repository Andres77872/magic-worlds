import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach,expect,it,vi } from 'vitest'
import { ManuscriptIdentity } from './manuscriptIdentity'
import { createManuscriptInvisibles,invisibleDecorations,INVISIBLES_KEY,INVISIBLE_WINDOW,setManuscriptInvisibles,type InvisibleLabels } from './manuscriptInvisibles'
import { captureDocument,documentRange,documentText } from '../manuscript'
import { documentSignature } from '@/shared/storyDocument'
import { manuscript } from '@/test/fixtures/story'
const labels:InvisibleLabels={space:'Space',tab:'Tab',paragraph:'Paragraph end',lineBreak:'Line break',noBreakSpace:'Nonbreaking space',zeroWidthSpace:'Zero-width space',wordJoiner:'Word joiner',byteOrderMark:'BOM'}
const editors:Editor[]=[]
function create(text='A🙂 é 👩‍🚀  gate\t\u00a0\u200b\u2060\ufeff'){
    const editor=new Editor({element:document.createElement('div'),extensions:[StarterKit.configure({code:false,codeBlock:false,underline:false,trailingNode:false}),ManuscriptIdentity,createManuscriptInvisibles({labels:()=>labels})],content:manuscript(text,'stable-invisible-block').content})
    editors.push(editor);return editor
}
afterEach(()=>{editors.splice(0).forEach(editor=>editor.destroy());vi.useRealTimers()})
it('shows whitespace and paragraph ends without changing saved text, offsets, selection or manual undo',()=>{
    vi.useFakeTimers()
    const editor=create(),end=editor.state.doc.content.size-1,updated=vi.fn();editor.on('update',updated)
    editor.commands.setTextSelection({from:1,to:end})
    const before=captureDocument(editor),range=documentRange(editor,1,end),selection=editor.state.selection.toJSON()
    expect(setManuscriptInvisibles(editor,true)).toBe(true);vi.advanceTimersByTime(32)
    const markers=[...editor.view.dom.querySelectorAll<HTMLElement>('.manuscript-invisible-marker')]
    expect(markers.length).toBeGreaterThan(0)
    expect(markers.map(marker=>marker.dataset.invisibleKind)).toEqual(expect.arrayContaining(['space','tab','paragraph','noBreakSpace','zeroWidthSpace','wordJoiner','byteOrderMark']))
    expect(markers.every(marker=>marker.getAttribute('aria-hidden')==='true'&&marker.contentEditable==='false')).toBe(true)
    expect(editor.view.dom.textContent).toBe(documentText(before))
    expect(editor.view.serializeForClipboard(editor.state.selection.content()).text).toBe(documentText(before))
    expect(captureDocument(editor)).toEqual(before);expect(documentRange(editor,1,end)).toEqual(range)
    expect(editor.state.selection.toJSON()).toEqual(selection);expect(updated).not.toHaveBeenCalled()
    editor.commands.setTextSelection(1);editor.commands.insertContent('New ')
    expect(documentText(captureDocument(editor))).toBe('New '+documentText(before))
    expect(editor.commands.undo()).toBe(true);expect(captureDocument(editor)).toEqual(before)
    setManuscriptInvisibles(editor,false);vi.advanceTimersByTime(32)
    expect(editor.view.dom.querySelectorAll('.manuscript-invisible-marker')).toHaveLength(0)
    expect(captureDocument(editor)).toEqual(before)
})
it('bounds decoration work to the requested document window and leaves emoji joiners intact',()=>{
    const editor=create('A'.repeat(50)+' '.repeat(INVISIBLE_WINDOW+500)+' 👩‍🚀')
    const before=documentSignature(captureDocument(editor))
    const decorations=invisibleDecorations(editor.state.doc,51,61,labels).find()
    expect(decorations).toHaveLength(10)
    expect(decorations.every(decoration=>decoration.from>=51&&decoration.from<61)).toBe(true)
    const full=invisibleDecorations(editor.state.doc,0,editor.state.doc.content.size,labels).find()
    expect(full.every(decoration=>decoration.from<INVISIBLE_WINDOW)).toBe(true)
    expect(documentSignature(captureDocument(editor))).toBe(before)
})
it('never paints markers or reads viewport geometry when the preference is disabled',()=>{
    vi.useFakeTimers()
    const editor=create(),box=vi.spyOn(editor.view.dom,'getBoundingClientRect')
    document.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize'));vi.advanceTimersByTime(32)
    expect(INVISIBLES_KEY.getState(editor.state)?.enabled).toBe(false)
    expect(editor.view.dom.querySelectorAll('.manuscript-invisible-marker')).toHaveLength(0)
    expect(box).not.toHaveBeenCalled()
})
it('keeps display toggling available for a read-only manuscript without issuing content updates',()=>{
    vi.useFakeTimers()
    const editor=create(),updated=vi.fn();editor.on('update',updated);editor.setEditable(false,false)
    const before=captureDocument(editor)
    setManuscriptInvisibles(editor,true);vi.advanceTimersByTime(32)
    expect(editor.view.dom.querySelectorAll('.manuscript-invisible-marker').length).toBeGreaterThan(0)
    expect(captureDocument(editor)).toEqual(before);expect(updated).not.toHaveBeenCalled()
})
