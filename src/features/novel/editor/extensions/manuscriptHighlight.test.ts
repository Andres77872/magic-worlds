import { chmodSync,writeFileSync } from 'node:fs'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { afterEach,expect,it } from 'vitest'
import { ManuscriptIdentity } from './manuscriptIdentity'
import { createManuscriptHighlight } from './manuscriptHighlight'
import { captureDocument,documentMarkdown,documentText,documentRange } from '../manuscript'
import { isStoryDocument } from '@/shared/storyDocument'
import { manuscript } from '@/test/fixtures/story'
const editors:Editor[]=[]
function create(content:object|string,markdown=false,canEdit=()=>true){
    const editor=new Editor({element:document.createElement('div'),extensions:[StarterKit.configure({code:false,codeBlock:false,underline:false,trailingNode:false}),Markdown,ManuscriptIdentity,createManuscriptHighlight(canEdit)],content,...(markdown?{contentType:'markdown' as const}:{})})
    editors.push(editor);return editor
}
afterEach(()=>{editors.splice(0).forEach(editor=>editor.destroy())})
it('round-trips highlighted punctuation, literal tags/entities and nested bold/link markup',()=>{
    const text='A * literal &copy; [gate] <mark> 🙂',source=manuscript(text,'original-block')
    source.content.content![0].content![0].marks=[{type:'bold'},{type:'link',attrs:{href:'https://example.test/gate?a=1&b=2'}},{type:'highlight'}]
    const editor=create(source.content),saved=captureDocument(editor),body=documentMarkdown(saved)
    expect(isStoryDocument(saved)).toBe(true);expect(body).toContain('<mark>')
    const reopened=captureDocument(create(body,true))
    expect(documentText(reopened)).toBe(text)
    const leaves=reopened.content.content!.flatMap(node=>node.content??[]).filter(node=>node.type==='text')
    expect(leaves.length).toBeGreaterThan(0)
    for(const node of leaves){expect(node.marks?.map(mark=>mark.type)).toEqual(expect.arrayContaining(['highlight','bold','link']))}
    expect(saved.content.content![0].attrs?.nodeId).toBe('original-block')
    editor.commands.selectAll();editor.commands.clearManuscriptHighlight()
    const unmarked=captureDocument(editor)
    expect(documentText(unmarked)).toBe(text)
    if(process.env.NOVEL_WRITING_MARKS_WIRE_OUT){
        const output=process.env.NOVEL_WRITING_MARKS_WIRE_OUT
        writeFileSync(output,JSON.stringify({schemaVersion:1,marked:saved,unmarked,markdown:body,fromMarkdown:reopened},null,2),{mode:0o600});chmodSync(output,0o600)
    }
})
it('does not turn escaped literal highlight delimiters into formatting',()=>{
    const source=manuscript('Read <mark> literally and close </mark>.','literal-block')
    const reopened=captureDocument(create(documentMarkdown(source),true))
    expect(documentText(reopened)).toBe(documentText(source))
    expect(reopened.content.content![0].content?.some(node=>node.marks?.some(mark=>mark.type==='highlight'))).toBe(false)
})
it('toggles one undoable author mark without changing plain-text offsets or block identity',()=>{
    const editor=create(manuscript('A🙂 gate','stable-block').content)
    editor.commands.setTextSelection({from:1,to:9})
    const before=documentRange(editor,1,9)
    expect(editor.commands.toggleManuscriptHighlight()).toBe(true)
    const saved=captureDocument(editor)
    expect(documentText(saved)).toBe('A🙂 gate')
    expect(saved.content.content![0].attrs?.nodeId).toBe('stable-block')
    expect(documentRange(editor,1,9)).toEqual(before)
    expect(editor.isActive('highlight')).toBe(true)
    expect(editor.commands.undo()).toBe(true);expect(editor.isActive('highlight')).toBe(false)
    expect(editor.commands.redo()).toBe(true);expect(editor.isActive('highlight')).toBe(true)
})
it('refuses formatting through commands while review or read-only ownership blocks writing',()=>{
    let allowed=false
    const editor=create(manuscript('Protected writing').content,false,()=>allowed)
    editor.commands.selectAll()
    const before=captureDocument(editor)
    expect(editor.commands.toggleManuscriptHighlight()).toBe(false)
    expect(captureDocument(editor)).toEqual(before)
    allowed=true;editor.setEditable(false)
    expect(editor.commands.toggleManuscriptHighlight()).toBe(false)
    expect(captureDocument(editor)).toEqual(before)
})
it('rejects duplicate highlights and pasted styling attributes in the canonical contract',()=>{
    for(const marks of [[{type:'highlight',attrs:{color:'red'}}],[{type:'highlight'},{type:'highlight'}]]){
        const source=manuscript('Marked')
        source.content.content![0].content![0].marks=marks
        expect(isStoryDocument(source)).toBe(false)
    }
})
