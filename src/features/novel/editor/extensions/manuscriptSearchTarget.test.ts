import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { Editor,Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorView } from '@tiptap/pm/view'
import { manuscript } from '@/test/fixtures/story'
import type { StoryManuscriptDocument } from '@/shared'
import { captureDocument } from '../manuscript'
import { documentText } from '@/shared/storyDocument'
import { ManuscriptIdentity } from './manuscriptIdentity'
import { MANUSCRIPT_TARGET_KEY,ManuscriptSearchHighlight,revealManuscriptSearchTarget } from './manuscriptSearchTarget'

const mentions=Node.create({name:'codexMention',group:'inline',inline:true,atom:true,
    addAttributes:()=>({id:{default:null},label:{default:null}}),renderHTML:({node})=>['span',{},'@'+node.attrs.label]})
const editors:Editor[]=[]
beforeEach(()=>{vi.spyOn(EditorView.prototype as unknown as {scrollToSelection:()=>void},'scrollToSelection').mockImplementation(()=>{})})
afterEach(()=>{editors.forEach((editor)=>editor.destroy());editors.length=0;vi.restoreAllMocks()})
function create(document:StoryManuscriptDocument){const editor=new Editor({element:window.document.createElement('div'),extensions:[StarterKit,ManuscriptIdentity,ManuscriptSearchHighlight,mentions],content:document.content});editors.push(editor);return editor}
function reveal(editor:Editor,first:number,last:number,document=captureDocument(editor)){
    return revealManuscriptSearchTarget(editor,{document,startOffset:first,endOffset:last,quote:documentText(document).slice(first,last),token:'result'})
}
it('maps the native UTF-16 source after emoji and leaves a collapsed caret without a document/history write',()=>{
    const editor=create(manuscript('A🙂 gate waits.')),before=captureDocument(editor)
    editor.commands.insertContent('Written ')
    const current=captureDocument(editor),at=documentText(current).indexOf('gate')
    expect(reveal(editor,at,at+4)).toBe(true)
    expect(editor.state.selection.empty).toBe(true)
    expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)?.find()).toHaveLength(1)
    expect(captureDocument(editor)).toEqual(current)
    editor.commands.undo()
    expect(captureDocument(editor)).toEqual(before)
    expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)?.find()).toHaveLength(0)
})
it('expands only the visual highlight for a partial mention label, never an editable range',()=>{
    const editor=create({schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId:'p'},content:[{type:'text',text:'Hello '},{type:'codexMention',attrs:{id:'owned-ref',label:'Mira'}},{type:'text',text:' waits.'}]}]}})
    expect(reveal(editor,8,10)).toBe(true)
    const decorations=MANUSCRIPT_TARGET_KEY.getState(editor.state)!.find()
    expect(decorations).toHaveLength(1)
    expect(decorations[0].to-decorations[0].from).toBe(1)
    expect(editor.state.selection.empty).toBe(true)
    editor.commands.insertContent('X')
    expect(documentText(captureDocument(editor))).toContain('@Mira')
})
it('maps nested lists and cross-block separators without searching for another equal phrase',()=>{
    const document:StoryManuscriptDocument={schemaVersion:1,content:{type:'doc',content:[
        {type:'bulletList',attrs:{nodeId:'list'},content:[{type:'listItem',attrs:{nodeId:'item'},content:[{type:'paragraph',attrs:{nodeId:'nested'},content:[{type:'text',text:'gate'}]}]}]},
        {type:'paragraph',attrs:{nodeId:'tail'},content:[{type:'text',text:'gate again'}]},
    ]}}
    const editor=create(document),text=documentText(captureDocument(editor))
    expect(text).toBe('gate\n\ngate again')
    expect(reveal(editor,4,6)).toBe(true)
    expect(editor.state.selection.empty).toBe(true)
    expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)!.find()).toHaveLength(0)
    expect(reveal(editor,3,8)).toBe(true)
    expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)!.find()).toHaveLength(2)
})
it('refuses changed documents, wrong quotes and UTF-16 splits, and clears stale decorations on edits',()=>{
    const original=manuscript('A🙂 gate waits.'),editor=create(original)
    expect(reveal(editor,2,3)).toBe(false)
    expect(revealManuscriptSearchTarget(editor,{document:original,startOffset:4,endOffset:8,quote:'door',token:'bad'})).toBe(false)
    editor.commands.insertContent('Later ')
    expect(reveal(editor,4,8,original)).toBe(false)
    const current=captureDocument(editor),first=documentText(current).indexOf('gate')
    expect(reveal(editor,first,first+4)).toBe(true)
    editor.commands.insertContent('New ')
    expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)!.find()).toHaveLength(0)
})

it('reveals stable cursor bookmarks in empty and Unicode paragraphs without replacing text or entering undo history',()=>{
    for(const [text,offset] of [['',0],['A🌒 gate',3],['At the end',10]] as const){
        const editor=create(manuscript(text,'saved-point')),document=captureDocument(editor)
        const target={document,startOffset:offset,endOffset:offset,quote:'',token:'bookmark',point:{nodeId:'saved-point',offset}}
        expect(revealManuscriptSearchTarget(editor,target)).toBe(true)
        expect(editor.state.selection.empty).toBe(true);expect(editor.state.selection.from).toBe(1+offset)
        expect(captureDocument(editor)).toEqual(document);expect(MANUSCRIPT_TARGET_KEY.getState(editor.state)?.find()).toHaveLength(0)
        expect(revealManuscriptSearchTarget(editor,{...target,point:{nodeId:'missing',offset}})).toBe(false)
        expect(revealManuscriptSearchTarget(editor,{...target,startOffset:offset+1,endOffset:offset+1})).toBe(false)
    }
})
