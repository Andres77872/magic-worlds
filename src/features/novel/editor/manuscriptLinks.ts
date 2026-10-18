import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { makeRequestId } from '@/utils/uuid'
import { isStoryDocument } from '@/shared/storyDocument'

export function isManuscriptLinkTitle(value:unknown):value is string {
    return typeof value==='string'&&value.length<=4096&&Array.from(value).every((c)=>c.length!==1||c.charCodeAt(0)<0xd800||c.charCodeAt(0)>0xdfff)
}

/** Only create complete destinations within the canonical protocol contract. */
export function isManuscriptLinkHref(value:unknown):value is string {
    if(typeof value!=='string'||!value||value.length>4096||Array.from(value).some((c)=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127)||!Array.from(value).every((c)=>c.length!==1||c.charCodeAt(0)<0xd800||c.charCodeAt(0)>0xdfff))return false
    try{
        const parsed=new URL(value)
        if(parsed.protocol==='http:'||parsed.protocol==='https:')return /^https?:\/\//i.test(value)&&Boolean(parsed.hostname)
        return (parsed.protocol==='mailto:'||parsed.protocol==='tel:')&&parsed.pathname.length>0
    }catch{return false}
}

export interface ManuscriptLinkTarget {
    id:string;editor:Editor;document:PMNode;from:number;to:number;href:string;title:string;label:string;attributes:Record<string,unknown>;hasLink:boolean;mixed:boolean
}
export function captureLinkTarget(editor:Editor,position?:number):ManuscriptLinkTarget|null {
    if(editor.isDestroyed)return null
    const {selection,doc,schema}=editor.state
    let {from,to}=position===undefined?selection:{from:position,to:position}
    if(from<0||from>doc.content.size)return null
    const range=from===to?getMarkRange(doc.resolve(from),schema.marks.link):undefined
    if(range){from=range.from;to=range.to}
    if(from===to&&!doc.resolve(from).parent.inlineContent)return null
    const links:Array<Record<string,unknown>>=[]
    let inline=false
    doc.nodesBetween(from,to,(node)=>{if(node.isText||node.type.name==='codexMention')inline=true;for(const mark of node.marks)if(mark.type===schema.marks.link)links.push(mark.attrs)})
    if(from!==to&&!inline)return null
    const existing=links[0],mixed=links.some((attrs)=>attrs.href!==existing?.href)
    return {id:makeRequestId('manuscript-link'),editor,document:doc,from,to,href:mixed?'':String(existing?.href??''),title:mixed?'':String(existing?.title??''),hasLink:links.length>0,mixed,
        label:doc.textBetween(from,to,'\n',(node)=>node.type.name==='codexMention'?'@'+String(node.attrs.label??node.attrs.id??''):''),attributes:existing&&!mixed?{...existing}:{}}
}
export const linkTargetCurrent=(editor:Editor|null,target:ManuscriptLinkTarget)=>Boolean(editor&&editor===target.editor&&!editor.isDestroyed&&editor.state.doc===target.document)

/** One normal, undoable document transaction; stale dialog targets never map by guess. */
export function applyManuscriptLink(editor:Editor,target:ManuscriptLinkTarget,href:string,title:string,remove=false):boolean {
    if(!editor.isEditable||!linkTargetCurrent(editor,target)||!editor.schema.marks.link||!remove&&(!isManuscriptLinkHref(href)||!isManuscriptLinkTitle(title)))return false
    const transaction=editor.state.tr,mark=editor.schema.marks.link
    if(remove){
        if(!target.hasLink||target.from===target.to)return false
        transaction.removeMark(target.from,target.to,mark).removeStoredMark(mark)
    }else{
        const attributes={...target.attributes,href,title:title||null}
        if(target.from===target.to){
            transaction.insertText(href,target.from).addMark(target.from,target.from+href.length,mark.create(attributes))
            transaction.setSelection(TextSelection.create(transaction.doc,target.from+href.length)).removeStoredMark(mark)
        }else transaction.addMark(target.from,target.to,mark.create(attributes))
    }
    if(!isStoryDocument({schemaVersion:1,content:transaction.doc.toJSON()}))return false
    editor.view.dispatch(transaction.setMeta('preventAutolink',true).scrollIntoView())
    return true
}

/** An inert template preserves caption AND unsupported destination as plain text. */
export function preservePastedLinks(html:string):{html:string;plainLinks:number} {
    const template=document.createElement('template');template.innerHTML=html
    let plainLinks=0
    for(const anchor of template.content.querySelectorAll('a[href]')){
        const href=anchor.getAttribute('href')??''
        const title=anchor.getAttribute('title')??''
        if(isManuscriptLinkHref(href)&&isManuscriptLinkTitle(title)){
            if(!anchor.textContent?.trim())anchor.append(document.createTextNode(href))
            continue
        }
        const label=anchor.textContent??'',children=[...anchor.childNodes]
        if(href&&label!==href)children.push(document.createTextNode((label?' (':'')+href+(label?')':'')))
        if(!isManuscriptLinkTitle(title))children.push(document.createTextNode(' ['+title+']'))
        anchor.replaceWith(...children);plainLinks++
    }
    return {html:template.innerHTML,plainLinks}
}
