import { Extension } from '@tiptap/core'
import { Plugin,PluginKey } from '@tiptap/pm/state'
import { preservePastedLinks } from '../manuscriptLinks'

/** Keep clipboard destinations inside the existing document schema. */
export function createManuscriptLinks(options:{onOpen:(position?:number)=>void;onPasteAsText:(count:number)=>void}){
    return Extension.create({name:'manuscriptLinks',
        addKeyboardShortcuts(){return {'Mod-k':()=>{options.onOpen();return true}}},
        addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('manuscriptLinkPaste'),props:{
            transformPastedHTML:(html)=>{const preserved=preservePastedLinks(html);if(preserved.plainLinks)options.onPasteAsText(preserved.plainLinks);return preserved.html},
            handleClick:(view,position,event)=>{
                const anchor=event.target instanceof Element?event.target.closest('a[href]'):null
                if(!anchor)return false
                event.preventDefault()
                if(event.ctrlKey||event.metaKey||!view.editable){options.onOpen(position);return true}
                return false
            },
        }})]},
    })
}
