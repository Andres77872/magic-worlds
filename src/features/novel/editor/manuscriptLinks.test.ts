import { afterEach,expect,it,vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorView } from '@tiptap/pm/view'
import { manuscript } from '@/test/fixtures/story'
import { captureDocument } from './manuscript'
import { documentMarkdown,documentText,isStoryDocument } from '@/shared/storyDocument'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { createManuscriptLinks } from './extensions/manuscriptLinks'
import { applyManuscriptLink,captureLinkTarget,isManuscriptLinkHref,preservePastedLinks } from './manuscriptLinks'

const editors:Editor[]=[]
afterEach(()=>{editors.forEach((editor)=>editor.destroy());editors.length=0;vi.restoreAllMocks()})
function create(options:{editable?:boolean;onOpen?:()=>void;onPasteAsText?:(n:number)=>void}={}){
    vi.spyOn(EditorView.prototype as unknown as {scrollToSelection:()=>void},'scrollToSelection').mockImplementation(()=>{})
    const editor=new Editor({element:document.createElement('div'),editable:options.editable??true,
        extensions:[StarterKit.configure({link:{openOnClick:false,defaultProtocol:'https',isAllowedUri:isManuscriptLinkHref,shouldAutoLink:isManuscriptLinkHref}}),ManuscriptIdentity,createManuscriptLinks({onOpen:options.onOpen??(()=>{}),onPasteAsText:options.onPasteAsText??(()=>{})})],
        content:manuscript('A🙂 reference waits.','stable-p').content})
    editors.push(editor);return editor
}
it('accepts supported complete destinations and rejects ambiguous, executable and malformed values',()=>{
    for(const value of ['https://example.com/a_(b)?x=1&y=2#part','HTTP://example.com','mailto:author@example.com?subject=Novel%20notes','tel:+525555555555','https://ejemplo.com/niñez'])expect(isManuscriptLinkHref(value)).toBe(true)
    for(const value of ['javascript:alert(1)','data:text/html,test','ftp://example.com','file:///tmp/text','#part','/relative','example.com','https:example.com','https://','mailto:','tel:','https://bad host','https://example.com/\n','https://example.com/\ud800','https://example.com/'+ 'x'.repeat(4096)])expect(isManuscriptLinkHref(value)).toBe(false)
})
it('adds a link to the exact frozen rich passage without replacing text and supports one-step undo',()=>{
    const editor=create();editor.commands.setTextSelection({from:5,to:14});editor.commands.toggleBold()
    const before=captureDocument(editor),target=captureLinkTarget(editor)!
    expect(target.label).toBe('reference')
    expect(applyManuscriptLink(editor,target,'https://example.com/niñez','Research (source)')).toBe(true)
    const saved=captureDocument(editor)
    expect(documentText(saved)).toBe(documentText(before));expect(isStoryDocument(saved)).toBe(true)
    const marked=saved.content.content![0].content!.find((node)=>node.text==='reference')!
    expect(marked.marks).toEqual(expect.arrayContaining([{type:'bold'},expect.objectContaining({type:'link',attrs:expect.objectContaining({href:'https://example.com/niñez',title:'Research (source)'})})]))
    editor.commands.undo();expect(captureDocument(editor)).toEqual(before)
})
it('inserts a visible URL at an empty cursor and removes links without deleting their captions',()=>{
    const editor=create();editor.commands.setTextSelection(1)
    expect(applyManuscriptLink(editor,captureLinkTarget(editor)!,'https://example.com','')).toBe(true)
    expect(documentText(captureDocument(editor))).toBe('https://example.comA🙂 reference waits.')
    editor.commands.setTextSelection(4)
    const target=captureLinkTarget(editor)!
    expect(target.href).toBe('https://example.com');expect(target.label).toBe('https://example.com')
    expect(applyManuscriptLink(editor,target,'','',true)).toBe(true)
    expect(documentText(captureDocument(editor))).toBe('https://example.comA🙂 reference waits.')
    expect(editor.isActive('link')).toBe(false)
})
it('does not apply a stale, foreign-editor or read-only dialog target',()=>{
    const editor=create(),target=captureLinkTarget(editor)!
    editor.commands.insertContent('Later ')
    const current=captureDocument(editor)
    expect(applyManuscriptLink(editor,target,'https://example.com','')).toBe(false)
    const foreign=create(),reader=create({editable:false})
    expect(applyManuscriptLink(foreign,captureLinkTarget(editor)!,'https://example.com','')).toBe(false)
    expect(applyManuscriptLink(reader,captureLinkTarget(reader)!,'https://example.com','')).toBe(false)
    expect(captureDocument(editor)).toEqual(current)
})
it('keeps the original document when link attributes would exceed the saved scene limit',()=>{
    const editor=create()
    editor.commands.setContent({type:'doc',content:Array.from({length:400},(_,index)=>({type:'paragraph',attrs:{nodeId:'large-'+index},content:[{type:'text',text:'Passage '+index}]}))})
    editor.commands.setTextSelection({from:1,to:editor.state.doc.content.size-1})
    const before=editor.state.doc,target=captureLinkTarget(editor)!
    expect(applyManuscriptLink(editor,target,'https://example.com/'+ 'a'.repeat(3000),'t'.repeat(3000))).toBe(false)
    expect(editor.state.doc).toBe(before)
    expect(applyManuscriptLink(editor,target,'https://example.com','\ud800')).toBe(false)
})
it('does not pretend to link a non-text block selection',()=>{
    const editor=create();editor.commands.setContent({type:'doc',content:[{type:'horizontalRule',attrs:{nodeId:'rule'}},{type:'paragraph',attrs:{nodeId:'after-rule'}}]})
    editor.commands.setNodeSelection(0)
    expect(captureLinkTarget(editor)).toBeNull()
})
it('identifies mixed destinations and removes only their links on explicit request',()=>{
    const editor=create();editor.commands.setContent({type:'doc',content:[{type:'paragraph',attrs:{nodeId:'mixed'},content:[
        {type:'text',text:'One',marks:[{type:'link',attrs:{href:'https://example.com/one'}}]},{type:'text',text:' and '},{type:'text',text:'two',marks:[{type:'link',attrs:{href:'https://example.com/two'}}]},
    ]}]})
    editor.commands.setTextSelection({from:1,to:editor.state.doc.content.size-1});const target=captureLinkTarget(editor)!
    expect(target).toMatchObject({mixed:true,href:'',hasLink:true,label:'One and two'})
    expect(applyManuscriptLink(editor,target,'','',true)).toBe(true)
    expect(editor.getText()).toBe('One and two');expect(editor.getHTML()).not.toContain('href=')
})
it('keeps unsupported destinations and captions as text, and retains empty safe-link destinations',()=>{
    const result=preservePastedLinks('<p><a href="ftp://example.com"><em>Archive</em></a> <a href="../chapter">Plan</a> <a href="https://example.com"><img alt="Cover" src="bad"></a></p>')
    const template=document.createElement('template');template.innerHTML=result.html
    expect(result.plainLinks).toBe(2);expect(template.content.textContent).toBe('Archive (ftp://example.com) Plan (../chapter) https://example.com')
    expect(template.content.querySelectorAll('a')).toHaveLength(1)
})
it('uses the actual paste pipeline to keep safe titles and unsupported URLs inside the save contract',()=>{
    const onPasteAsText=vi.fn(),editor=create({onPasteAsText})
    editor.view.pasteHTML('<p><a href="https://example.com/source" title="Original title"><strong>Paper</strong></a> and <a href="javascript:alert(1)">Notes</a> and <a href="ftp://example.com/archive">Archive</a>.</p>',new Event('paste') as ClipboardEvent)
    const saved=captureDocument(editor)
    expect(isStoryDocument(saved)).toBe(true)
    expect(documentText(saved)).toContain('Notes (javascript:alert(1)) and Archive (ftp://example.com/archive)')
    const links:unknown[]=[];saved.content.content?.forEach((block)=>block.content?.forEach((node)=>node.marks?.forEach((mark)=>{if(mark.type==='link')links.push(mark.attrs)})))
    expect(links).toEqual([expect.objectContaining({href:'https://example.com/source',title:'Original title'})])
    expect(onPasteAsText).toHaveBeenCalledWith(2)
    if(process.env.NOVEL_EDITOR_LINK_WIRE_OUT)writeFileSync(process.env.NOVEL_EDITOR_LINK_WIRE_OUT,JSON.stringify({document:saved,plainText:documentText(saved),body:documentMarkdown(saved)}),{mode:0o600})
})
it('never stores an unsupported plain URL pasted onto a selected caption as a link',()=>{
    const editor=create();editor.commands.setTextSelection({from:5,to:14});editor.view.pasteText('ftp://example.com/archive',new Event('paste') as ClipboardEvent)
    const saved=captureDocument(editor)
    expect(isStoryDocument(saved)).toBe(true);expect(documentText(saved)).toContain('ftp://example.com/archive')
    expect(saved.content.content![0].content!.some((node)=>node.marks?.some((mark)=>mark.type==='link'))).toBe(false)
})
