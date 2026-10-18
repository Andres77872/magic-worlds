import type { StoryAnchorEdit } from './types/storyAnnotation.types'

export const MAX_ANCHOR_EDITS=2_000,MAX_ANCHOR_EDIT_WORK=32_000_000
const boundary=(text:string,at:number)=>at>=0&&at<=text.length&&!(at>0&&at<text.length&&text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff)
export function isStoryAnchorEdits(value:unknown):value is StoryAnchorEdit[] {
    if(!Array.isArray(value)||value.length>MAX_ANCHOR_EDITS)return false
    let bytes=0
    return value.every((edit)=>{
        if(!edit||typeof edit!=='object'||Object.keys(edit).length!==3||!Number.isSafeInteger(edit.from)||!Number.isSafeInteger(edit.to)||edit.from<0||edit.to<edit.from||typeof edit.text!=='string')return false
        bytes+=new TextEncoder().encode(edit.text).length
        return bytes<=2_000_000
    })
}
export function applyStoryAnchorEdits(text:string,edits:unknown):string|null {
    if(!isStoryAnchorEdits(edits))return null
    let work=0
    for(const edit of edits){
        work+=text.length+edit.text.length
        if(work>MAX_ANCHOR_EDIT_WORK||!boundary(text,edit.from)||!boundary(text,edit.to))return null
        text=text.slice(0,edit.from)+edit.text+text.slice(edit.to)
    }
    return text
}
