import type { StoryAnnotationAnchor,StoryDocumentNode,StorySceneDocument,StoryManuscriptDocument } from './types'
import { documentText,isStoryDocument,nodeText } from './storyDocument'

export interface AnnotationRange {startOffset:number;endOffset:number;text:string}
/** Resolve exact stable points in the identified saved scene, without text search. */
export function resolveAnnotationRange(scene:StorySceneDocument,anchor:StoryAnnotationAnchor):AnnotationRange|null {
    if(scene.id!==anchor.sceneId||scene.revision!==anchor.revision||scene.contentHash!==anchor.contentHash||!isStoryDocument(scene.document))return null
    return resolveDocumentAnnotationRange(scene.document,anchor)
}
/** Exact geometry in a separately verified checkpoint or reader document. */
export function resolveDocumentAnnotationRange(document:StoryManuscriptDocument,anchor:Pick<StoryAnnotationAnchor,'start'|'end'|'quote'>):AnnotationRange|null {
    if(!isStoryDocument(document))return null
    const blocks=new Map<string,{text:string;at:number;atoms:Array<[number,number]>}>()
    const visit=(node:StoryDocumentNode,at:number):number=>{
        if(node.type==='paragraph'||node.type==='heading'){
            const text=nodeText(node),atoms:Array<[number,number]>=[];let position=0
            for(const child of node.content??[]){const length=nodeText(child).length;if(child.type==='codexMention')atoms.push([position,position+length]);position+=length}
            blocks.set(String(node.attrs?.nodeId),{text,at,atoms});return text.length
        }
        const children=node.content??[]
        if(!children.length)return nodeText(node).length
        const separator=node.type==='bulletList'||node.type==='orderedList'?1:2
        let next=at
        children.forEach((child,index)=>{if(index)next+=separator;next+=visit(child,next)})
        return next-at
    }
    visit(document.content,0)
    const point=(value:StoryAnnotationAnchor['start'])=>{
        const block=blocks.get(value.nodeId),at=value.offset
        if(!block||!Number.isSafeInteger(at)||at<0||at>block.text.length||block.atoms.some(([start,end])=>start<at&&at<end))return null
        if(at>0&&at<block.text.length&&block.text.charCodeAt(at-1)>=0xd800&&block.text.charCodeAt(at-1)<=0xdbff&&block.text.charCodeAt(at)>=0xdc00&&block.text.charCodeAt(at)<=0xdfff)return null
        return block.at+at
    }
    const first=point(anchor.start),last=point(anchor.end),text=documentText(document)
    const exactPoint=anchor.quote===''&&anchor.start.nodeId===anchor.end.nodeId&&anchor.start.offset===anchor.end.offset
    return first!==null&&last!==null&&(last>first||exactPoint&&last===first)&&text.slice(first,last)===anchor.quote?{startOffset:first,endOffset:last,text:anchor.quote}:null
}
export function annotationContext(text:string,range:AnnotationRange){
    let first=Math.max(0,range.startOffset-240),last=Math.min(text.length,range.endOffset+240)
    const split=(at:number)=>at>0&&at<text.length&&text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff
    if(split(first))first--;if(split(last))last++
    return {before:text.slice(first,range.startOffset),quote:range.text,after:text.slice(range.endOffset,last),beforeCut:first>0,afterCut:last<text.length}
}
