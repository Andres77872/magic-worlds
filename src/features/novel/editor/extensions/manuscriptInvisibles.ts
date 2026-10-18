import { Extension,type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin,PluginKey } from '@tiptap/pm/state'
import { Decoration,DecorationSet,type EditorView } from '@tiptap/pm/view'

export type InvisibleKind='space'|'tab'|'lineBreak'|'paragraph'|'noBreakSpace'|'zeroWidthSpace'|'wordJoiner'|'byteOrderMark'
export type InvisibleLabels=Record<InvisibleKind,string>
interface InvisibleState {enabled:boolean;paint:number;decorations:DecorationSet}
interface ViewOptions {labels:()=>InvisibleLabels;viewport?:()=>DOMRect|null}
export const INVISIBLES_KEY=new PluginKey<InvisibleState>('manuscriptInvisibles')
export const INVISIBLE_WINDOW=20_000
const symbols:Record<string,{kind:InvisibleKind;symbol:string}>={
    ' ':{kind:'space',symbol:'·'},'\t':{kind:'tab',symbol:'→'},'\n':{kind:'lineBreak',symbol:'↵'},'\r':{kind:'lineBreak',symbol:'↵'},
    '\u00a0':{kind:'noBreakSpace',symbol:'⍽'},'\u200b':{kind:'zeroWidthSpace',symbol:'ZWSP'},'\u2060':{kind:'wordJoiner',symbol:'WJ'},'\ufeff':{kind:'byteOrderMark',symbol:'BOM'},
}
/** Pure bounded projection. Widgets never enter the ProseMirror document. */
export function invisibleDecorations(doc:PMNode,from:number,to:number,labels:InvisibleLabels):DecorationSet {
    const start=Math.max(0,Math.min(from,doc.content.size)),end=Math.max(start,Math.min(to,start+INVISIBLE_WINDOW,doc.content.size))
    if(start===end)return DecorationSet.empty
    const decorations:Decoration[]=[]
    function add(at:number,kind:InvisibleKind,symbol:string){
        if(at<start||at>=end)return
        decorations.push(Decoration.widget(at,()=>{
            const marker=document.createElement('span')
            marker.className='manuscript-invisible-marker';marker.dataset.invisibleKind=kind
            marker.setAttribute('aria-hidden','true');marker.contentEditable='false';marker.title=labels[kind];marker.dataset.invisibleSymbol=symbol
            return marker
        },{side:-1,key:at+':'+kind+':'+labels[kind],ignoreSelection:true}))
    }
    doc.nodesBetween(start,end,(node,at)=>{
        if(node.type.name==='aiBeat'||node.type.name==='codexMention')return false
        if(node.isText){
            const offset=Math.max(0,start-at),text=(node.text??'').slice(offset,Math.max(offset,end-at))
            for(const match of text.matchAll(/[ \t\n\r\u00a0\u200b\u2060\ufeff]/g)){
                const value=symbols[match[0]];add(at+offset+match.index,value.kind,value.symbol)
            }
            return false
        }
        if(node.type.name==='hardBreak')add(at,'lineBreak','↵')
        if(node.isTextblock)add(at+node.nodeSize-1,'paragraph','¶')
    })
    return DecorationSet.create(doc,decorations)
}
function visibleWindow(view:EditorView,viewport?:()=>DOMRect|null):{from:number;to:number}|null {
    const size=view.state.doc.content.size,selection=view.state.selection.head
    const fallback=()=>({from:Math.max(0,selection-2000),to:Math.min(size,selection+2000)})
    try{
        const box=view.dom.getBoundingClientRect(),clip=viewport?.()
        if(!box.height||!box.width)return fallback()
        const top=Math.max(0,box.top,clip?.top??0),bottom=Math.min(window.innerHeight,box.bottom,clip?.bottom??window.innerHeight)
        if(bottom<=top)return null
        const x=Math.max(0,Math.min(window.innerWidth-1,box.left+box.width/2))
        const first=view.posAtCoords({left:x,top:top+Math.min(2,(bottom-top)/2)})?.pos
        const last=view.posAtCoords({left:x,top:bottom-Math.min(2,(bottom-top)/2)})?.pos
        if(first===undefined||last===undefined)return fallback()
        const from=Math.max(0,Math.min(first,last)-2000)
        return {from,to:Math.min(size,Math.max(first,last)+2000,from+INVISIBLE_WINDOW)}
    }catch{return fallback()}
}
/** Scroll/resize paints a bounded visible window; no document or history write. */
export function createManuscriptInvisibles(options:ViewOptions){
    return Extension.create({name:'manuscriptInvisibles',addProseMirrorPlugins(){return [new Plugin<InvisibleState>({
        key:INVISIBLES_KEY,
        state:{
            init:()=>({enabled:false,paint:0,decorations:DecorationSet.empty}),
            apply(tr,previous){
                const change=tr.getMeta(INVISIBLES_KEY) as {enabled?:boolean;decorations?:DecorationSet}|undefined
                if(change?.enabled!==undefined)return {enabled:change.enabled,paint:previous.paint+1,decorations:change.enabled?previous.decorations:DecorationSet.empty}
                if(change?.decorations)return {...previous,decorations:change.decorations}
                return tr.docChanged?{...previous,decorations:previous.decorations.map(tr.mapping,tr.doc)}:previous
            },
        },
        props:{decorations:state=>INVISIBLES_KEY.getState(state)?.decorations??DecorationSet.empty},
        view(view){
            let frame:number|null=null,force=false,lastDoc:PMNode|null=null,lastWindow='',disposed=false
            function schedule(refresh=false){
                force=force||refresh
                if(disposed||frame!==null||view.composing||!INVISIBLES_KEY.getState(view.state)?.enabled)return
                frame=window.requestAnimationFrame(()=>{
                    frame=null
                    if(disposed||view.isDestroyed||view.composing||!INVISIBLES_KEY.getState(view.state)?.enabled)return
                    const range=visibleWindow(view,options.viewport),key=range?range.from+':'+range.to:'hidden'
                    if(!force&&lastDoc===view.state.doc&&lastWindow===key)return
                    force=false;lastDoc=view.state.doc;lastWindow=key
                    const decorations=range?invisibleDecorations(view.state.doc,range.from,range.to,options.labels()):DecorationSet.empty
                    view.dispatch(view.state.tr.setMeta(INVISIBLES_KEY,{decorations}).setMeta('addToHistory',false))
                })
            }
            const scroll=()=>schedule(),refresh=()=>schedule(true)
            const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(refresh)
            observer?.observe(view.dom)
            document.addEventListener('scroll',scroll,true);window.addEventListener('resize',refresh);view.dom.addEventListener('compositionend',refresh)
            return {
                update(current,previous){
                    const state=INVISIBLES_KEY.getState(current.state),old=INVISIBLES_KEY.getState(previous)
                    if(state?.paint!==old?.paint)schedule(true)
                    else if(current.state.doc!==previous.doc||!current.state.selection.eq(previous.selection))schedule()
                },
                destroy(){disposed=true;observer?.disconnect();if(frame!==null)window.cancelAnimationFrame(frame);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',refresh);view.dom.removeEventListener('compositionend',refresh)},
            }
        },
    })]}})
}
export function setManuscriptInvisibles(editor:Editor,enabled:boolean):boolean {
    if(editor.isDestroyed||!INVISIBLES_KEY.getState(editor.state))return false
    editor.view.dispatch(editor.state.tr.setMeta(INVISIBLES_KEY,{enabled}).setMeta('addToHistory',false))
    return true
}
