/** Ephemeral saved-result highlight. It never becomes an editable replacement range. */
import { Extension,type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin,PluginKey,TextSelection } from '@tiptap/pm/state'
import { Decoration,DecorationSet } from '@tiptap/pm/view'
import type { StoryManuscriptDocument,StoryAnnotationPoint } from '@/shared'
import { captureDocument } from '../manuscript'
import { documentSignature,documentText } from '@/shared/storyDocument'
import { resolveDocumentAnnotationRange } from '@/shared/storyAnnotationAnchors'

export interface ManuscriptSearchTarget {document:StoryManuscriptDocument;startOffset:number;endOffset:number;quote:string;token:string;point?:StoryAnnotationPoint}
export const MANUSCRIPT_TARGET_KEY=new PluginKey<DecorationSet>('manuscriptSearchTarget')
interface Segment {start:number;end:number;from:number;to:number;atom:boolean}
export function manuscriptSegments(doc:PMNode):Segment[] {
    const segments:Segment[]=[]
    let plain=0
    const visit=(node:PMNode,at:number)=>{
        const kind=node.type.name
        if(kind==='horizontalRule'||kind==='aiBeat')return
        if(node.isText||kind==='hardBreak'||kind==='codexMention'){
            const length=node.isText?(node.text??'').length:kind==='hardBreak'?1:('@'+String(node.attrs.label??node.attrs.id??'')).length
            segments.push({start:plain,end:plain+length,from:at,to:at+node.nodeSize,atom:kind==='codexMention'})
            plain+=length;return
        }
        const separator=kind==='paragraph'||kind==='heading'?0:kind==='bulletList'||kind==='orderedList'?1:2
        node.forEach((child,offset,index)=>{if(index)plain+=separator;visit(child,at+(kind==='doc'?0:1)+offset)})
    }
    visit(doc,0)
    return segments
}
export function scrollManuscriptSearchTarget(editor:Editor,scrollport:HTMLElement):void {
    const coords=editor.view.coordsAtPos(editor.state.selection.head),box=scrollport.getBoundingClientRect()
    scrollport.scrollTop+=coords.top-box.top-box.height*0.45
}
export function revealManuscriptSearchTarget(editor:Editor,target:ManuscriptSearchTarget):boolean {
    if(editor.isDestroyed||documentSignature(captureDocument(editor))!==documentSignature(target.document))return false
    const text=documentText(target.document),first=target.startOffset,last=target.endOffset
    if(target.point){
        const point=target.point,range=resolveDocumentAnnotationRange(target.document,{start:point,end:point,quote:''})
        if(!range||first!==last||first!==range.startOffset||target.quote!=='')return false
        let position:number|null=null
        editor.state.doc.descendants((node,at)=>{
            if(position!==null)return false
            if(!['paragraph','heading'].includes(node.type.name)||node.attrs.nodeId!==point.nodeId)return
            let plain=0
            node.forEach((child,offset)=>{
                if(position!==null)return
                const length=child.isText?(child.text??'').length:child.type.name==='hardBreak'?1:child.type.name==='codexMention'?('@'+String(child.attrs.label??child.attrs.id??'')).length:0
                if(point.offset>=plain&&point.offset<=plain+length)position=at+1+offset+(child.isText?point.offset-plain:point.offset===plain?0:child.nodeSize)
                plain+=length
            })
            if(position===null&&point.offset===plain)position=at+1+node.content.size
            return false
        })
        if(position===null)return false
        editor.view.dispatch(editor.state.tr.setMeta(MANUSCRIPT_TARGET_KEY,DecorationSet.empty).setMeta('addToHistory',false).setSelection(TextSelection.near(editor.state.doc.resolve(position),1)).scrollIntoView())
        editor.view.focus();return true
    }
    const split=(at:number)=>at>0&&at<text.length&&text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff
    if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<0||last<=first||last>text.length||split(first)||split(last)||text.slice(first,last)!==target.quote)return false
    const segments=manuscriptSegments(editor.state.doc),overlap=segments.filter((segment)=>segment.end>first&&segment.start<last)
    const decorations=overlap.map((segment)=>segment.atom?
        Decoration.node(segment.from,segment.to,{class:'search-match search-match-active'}):
        Decoration.inline(segment.from+Math.max(0,first-segment.start),segment.from+Math.min(segment.end-segment.start,last-segment.start),{class:'search-match search-match-active'}))
    const nearest=overlap[0]??segments.find((segment)=>segment.start>=first)??segments[segments.length-1]
    if(!nearest)return false
    const at=nearest.atom?nearest.from:nearest.from+Math.max(0,Math.min(nearest.to-nearest.from,first-nearest.start))
    const selection=TextSelection.near(editor.state.doc.resolve(at),1)
    // A selection-only transaction stays out of manuscript history and storage.
    editor.view.dispatch(editor.state.tr.setMeta(MANUSCRIPT_TARGET_KEY,DecorationSet.create(editor.state.doc,decorations)).setMeta('addToHistory',false).setSelection(selection).scrollIntoView())
    editor.view.focus()
    return true
}
export const ManuscriptSearchHighlight=Extension.create({
    name:'manuscriptSearchTarget',
    addProseMirrorPlugins(){return [new Plugin<DecorationSet>({key:MANUSCRIPT_TARGET_KEY,state:{init:()=>DecorationSet.empty,
        apply:(transaction,previous)=>transaction.docChanged?DecorationSet.empty:transaction.getMeta(MANUSCRIPT_TARGET_KEY)??previous},
        props:{decorations:(state)=>MANUSCRIPT_TARGET_KEY.getState(state)??DecorationSet.empty,
            attributes:(state):Record<string,string>=>MANUSCRIPT_TARGET_KEY.getState(state)?.find().length?{'data-manuscript-search-target':'true'}:{}}})]},
})
