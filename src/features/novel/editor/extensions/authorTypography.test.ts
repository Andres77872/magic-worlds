import { afterEach,expect,it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { manuscript } from '@/test/fixtures/story'
import { DEFAULT_TYPING,PLAIN_TYPING,type TypingPreferences } from '../../utils/typingPreferences'
import { createAuthorTypography } from './authorTypography'

const editors:Editor[]=[]
afterEach(()=>{editors.forEach((editor)=>editor.destroy());editors.length=0})
function create(preferences:()=>TypingPreferences,language:()=>string=()=> 'English'){
    const editor=new Editor({element:document.createElement('div'),extensions:[StarterKit,createAuthorTypography(preferences,language)],content:manuscript().content})
    editors.push(editor);return editor
}
function type(editor:Editor,text:string){
    for(const character of text){const {from,to}=editor.state.selection
        const handled=editor.view.someProp('handleTextInput',(handler)=>handler(editor.view,from,to,character,()=>editor.state.tr.insertText(character,from,to)))
        if(!handled)editor.commands.insertContent(character)
    }
}
it('uses manuscript English and Spanish quote choices for new typing only',()=>{
    let language='English';const editor=create(()=>DEFAULT_TYPING,()=>language)
    type(editor,'"Hello" ');expect(editor.getText()).toBe('“Hello” ')
    language='es-MX';type(editor,'"Hola"');expect(editor.getText()).toBe('“Hello” «Hola»')
})
it('changes preferences without rebuilding the editor or rewriting previous prose',()=>{
    let preferences=DEFAULT_TYPING;const editor=create(()=>preferences)
    type(editor,'"Hello" ');const before=editor.state.doc
    preferences=PLAIN_TYPING;expect(editor.state.doc).toBe(before)
    type(editor,'"Hola" -- ... (c) 1/2');expect(editor.getText()).toBe('“Hello” "Hola" -- ... (c) 1/2')
})
it('gates punctuation and symbols independently and keeps pasted text literal',()=>{
    let preferences:TypingPreferences={quotes:'straight',punctuation:true,symbols:false};const editor=create(()=>preferences)
    type(editor,'-- ... (c) ');expect(editor.getText()).toBe('— … (c) ')
    preferences={quotes:'angle',punctuation:false,symbols:true};type(editor,'"Hola" -- (c)');expect(editor.getText()).toBe('— … (c) «Hola» -- ©')
    editor.view.pasteText(' "literal" -- ...',new Event('paste') as ClipboardEvent)
    expect(editor.getText()).toContain('"literal" -- ...')
})
it('lets an explicit style override the manuscript language and keeps input-rule undo available',()=>{
    const editor=create(()=>({...DEFAULT_TYPING,quotes:'curly'}),()=> 'Español')
    type(editor,'"');expect(editor.getText()).toBe('“')
    expect(editor.commands.undoInputRule()).toBe(true);expect(editor.getText()).toBe('"')
})
