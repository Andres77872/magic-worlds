import { Mark,mergeAttributes } from '@tiptap/core'

export const MANUSCRIPT_HIGHLIGHT='highlight'
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        manuscriptHighlight:{
            toggleManuscriptHighlight:()=>ReturnType
            clearManuscriptHighlight:()=>ReturnType
        }
    }
}
/** One author highlight style; arbitrary pasted CSS never enters the document. */
export function createManuscriptHighlight(canEdit:()=>boolean=()=>true){
    return Mark.create({
        name:MANUSCRIPT_HIGHLIGHT,
        parseHTML:()=>[{tag:'mark'}],
        renderHTML:({HTMLAttributes})=>['mark',mergeAttributes(HTMLAttributes,{class:'manuscript-highlight'}),0],
        markdownTokenName:'manuscriptHighlight',
        markdownTokenizer:{
            name:'manuscriptHighlight',level:'inline',start:source=>source.indexOf('<mark>'),
            tokenize(source,_tokens,lexer){
                if(!source.startsWith('<mark>'))return
                const closing=source.indexOf('</mark>',6)
                if(closing<0)return
                const raw=source.slice(0,closing+7)
                return {type:'manuscriptHighlight',raw,tokens:lexer.inlineTokens(source.slice(6,closing))}
            },
        },
        parseMarkdown:(token,helpers)=>helpers.applyMark(MANUSCRIPT_HIGHLIGHT,helpers.parseInline(token.tokens??[])),
        renderMarkdown:(node,helpers)=>'<mark>'+helpers.renderChildren(node)+'</mark>',
        addCommands(){return {
            toggleManuscriptHighlight:()=>({editor,commands})=>editor.isEditable&&canEdit()&&commands.toggleMark(this.name),
            clearManuscriptHighlight:()=>({editor,commands})=>editor.isEditable&&canEdit()&&commands.unsetMark(this.name),
        }},
        addKeyboardShortcuts(){return {'Mod-Shift-h':()=>!this.editor.isEditable||!canEdit()?true:this.editor.commands.toggleManuscriptHighlight()}},
    })
}
