import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import type { Transaction } from '@tiptap/pm/state'
import { afterEach,expect,it } from 'vitest'
import { identifyDocument,documentText } from '@/shared/storyDocument'
import { applyStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { AiBeat } from './extensions/aiBeat'
import { createCodexMention } from './extensions/codexMention'
import { transactionAnchorEdits } from './anchorEdits'

const last=<T,>(values:T[])=>values[values.length-1]
const editors:Editor[]=[]
function setup(content=identifyDocument({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'aaa'}]}]})){
    const traces:Array<ReturnType<typeof transactionAnchorEdits>>=[],transactions:Transaction[][]=[]
    const editor=new Editor({element:document.createElement('div'),extensions:[StarterKit,ManuscriptIdentity,AiBeat,createCodexMention(()=>[])],content:content.content,
        onTransaction:({transaction,appendedTransactions})=>{const batch=[transaction,...appendedTransactions];transactions.push(batch);traces.push(transactionAnchorEdits(batch))}})
    editors.push(editor);return {editor,traces,transactions}
}
const text=(editor:Editor)=>documentText({schemaVersion:1,content:editor.getJSON()})
afterEach(()=>editors.splice(0).forEach((editor)=>editor.destroy()))
it('records the actual insertion point among identical characters',()=>{
    const {editor,traces}=setup();editor.commands.insertContentAt(1,'a')
    expect(last(traces)).toEqual([{from:0,to:0,text:'a'}]);expect(text(editor)).toBe('aaaa')
})
it('combines actual sequential transactions without deriving a first-match text diff',()=>{
    const {editor,traces}=setup();editor.commands.insertContentAt(1,'x');editor.commands.insertContentAt(5,'y')
    expect(applyStoryAnchorEdits('aaa',traces.flat())).toBe('xaaay')
    expect(traces).toEqual([[{from:0,to:0,text:'x'}],[{from:4,to:4,text:'y'}]])
})
it('maps paragraph splitting and appended identity transactions into the same projection',()=>{
    const {editor,traces,transactions}=setup();editor.commands.setTextSelection(2);editor.commands.splitBlock()
    const changes=last(traces)
    expect(changes).not.toBeNull();expect(applyStoryAnchorEdits('aaa',changes)).toBe('a\n\naa')
    expect(last(transactions)!.length).toBeGreaterThan(1)
    expect(editor.getJSON().content![0].attrs!.nodeId).not.toBe(editor.getJSON().content![1].attrs!.nodeId)
})
it('preserves Unicode offsets and handles the atomic plain label of a mention',()=>{
    const source=identifyDocument({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'🌒 '},{type:'codexMention',attrs:{id:'mira',label:'Mira'}},{type:'text',text:' waits.'}]}]})
    const {editor,traces}=setup(source),before=text(editor)
    editor.commands.insertContentAt(5,' calm')
    expect(applyStoryAnchorEdits(before,last(traces))).toBe(text(editor))
    expect(last(traces)).toEqual([{from:8,to:8,text:' calm'}])
})
it('ignores formatting-only changes while preserving the canonical block identity',()=>{
    const {editor,traces}=setup();editor.commands.setTextSelection({from:1,to:4});editor.commands.toggleBold()
    expect(last(traces)).toEqual([]);expect(text(editor)).toBe('aaa')
})
it('validates whole-paragraph deletion at both document boundaries',()=>{
    for(const first of [true,false]){
        const {editor,traces}=setup(identifyDocument({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'First.'}]},{type:'paragraph',content:[{type:'text',text:'Last.'}]}]})),before=text(editor)
        const boundary=editor.state.doc.firstChild!.nodeSize
        editor.commands.deleteRange(first?{from:0,to:boundary}:{from:boundary,to:editor.state.doc.content.size})
        expect(last(traces)).not.toBeNull();expect(applyStoryAnchorEdits(before,last(traces))).toBe(text(editor))
    }
})
it('rejects malformed, surrogate-splitting, oversized and excessively expensive traces',()=>{
    expect(applyStoryAnchorEdits('🌒',[{from:1,to:2,text:''}])).toBeNull()
    expect(applyStoryAnchorEdits('abc',[{from:0,to:0,text:'',extra:true}])).toBeNull()
    expect(applyStoryAnchorEdits('abc',Array.from({length:2001},()=>({from:0,to:0,text:''})))).toBeNull()
    expect(applyStoryAnchorEdits('a'.repeat(100_000),Array.from({length:321},()=>({from:0,to:0,text:''})))).toBeNull()
})
