import { generateUUID } from '@/utils/uuid'
/** TipTap adapter over the shared canonical scene document contract. */
import type { Editor } from '@tiptap/core'
import type { StoryManuscriptDocument } from '@/shared'
import { identifyDocument, documentText, nodeText } from '@/shared/storyDocument'
export { identifyDocument, documentText, documentMarkdown, MANUSCRIPT_BLOCKS } from '@/shared/storyDocument'
export type ManuscriptDocument = StoryManuscriptDocument
export const captureDocument = (editor: Editor): ManuscriptDocument => identifyDocument(editor.getJSON())

/** Map a PM cursor/selection through the exact canonical plain-text projection. */
export function documentRange(editor: Editor, from: number, to = from): { startOffset: number; endOffset: number; text: string } | null {
    const original = documentText({ schemaVersion: 1, content: editor.getJSON() })
    const id = generateUUID().replace(/-/g, '')
    const start = `NOVELSTART${id}`
    const end = `NOVELEND${id}`
    const marked = editor.state.tr.insertText(end, to).insertText(start, from)
    const serialized = documentText({ schemaVersion: 1, content: marked.doc.toJSON() })
    const startOffset = serialized.indexOf(start)
    const endOffset = serialized.indexOf(end) - start.length
    if (startOffset < 0 || endOffset < startOffset || serialized.replace(start, '').replace(end, '') !== original) return null
    return { startOffset, endOffset, text: original.slice(startOffset, endOffset) }
}

export function splitCursor(editor: Editor): { nodeId: string; offset: number } | null {
    if (!editor.state.selection.empty) return null
    const resolved = editor.state.selection.$from
    if (!['paragraph', 'heading'].includes(resolved.parent.type.name)) return null
    const nodeId = resolved.parent.attrs.nodeId
    if (!nodeId) return null
    const prefix = resolved.parent.cut(0, resolved.parentOffset).toJSON()
    return { nodeId, offset: nodeText(prefix).length }
}

export interface ManuscriptPosition {
    anchor:{nodeId:string;offset:number}
    head:{nodeId:string;offset:number}
    scrollTop:number
    documentFingerprint?:string
}
export function isManuscriptPosition(value: unknown): value is ManuscriptPosition {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const p = value as Record<string, unknown>
    if ((Object.keys(p).length !== 3 && Object.keys(p).length !== 4) || typeof p.scrollTop !== 'number' || !Number.isFinite(p.scrollTop) || p.scrollTop < 0 || p.scrollTop > 10_000_000) return false
    if (Object.keys(p).length === 4 && (typeof p.documentFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(p.documentFingerprint))) return false
    return [p.anchor, p.head].every((point) => {
        if (!point || typeof point !== 'object' || Array.isArray(point)) return false
        const at = point as Record<string, unknown>
        return Object.keys(at).length === 2 && typeof at.nodeId === 'string' && at.nodeId.length > 0 && at.nodeId.length <= 64
            && Number.isSafeInteger(at.offset) && (at.offset as number) >= 0
    })
}
export function capturePosition(editor:Editor,scrollTop=0):ManuscriptPosition|null {
    const point=(at:number)=>{
        const resolved=editor.state.doc.resolve(at)
        const nodeId=resolved.parent.attrs.nodeId
        if (typeof nodeId!=='string'||!nodeId||!['paragraph','heading'].includes(resolved.parent.type.name)) return null
        return {nodeId,offset:nodeText(resolved.parent.cut(0,resolved.parentOffset).toJSON()).length}
    }
    const anchor=point(editor.state.selection.anchor)
    const head=point(editor.state.selection.head)
    return anchor&&head ? {anchor,head,scrollTop} : null
}
export function restorePosition(editor:Editor,position:ManuscriptPosition):boolean {
    if (!isManuscriptPosition(position)) return false
    const locate=(point:ManuscriptPosition['anchor'])=>{
        let result:number|null=null
        editor.state.doc.descendants((node,at)=>{
            if (node.attrs.nodeId!==point.nodeId||!node.isTextblock) return
            let remaining=Math.max(0,point.offset)
            let offset=0
            let valid=true
            node.forEach((child)=>{
                const length=nodeText(child.toJSON()).length
                if (remaining<=0) return
                if (remaining>=length) {offset+=child.nodeSize;remaining-=length}
                else {
                    if (!child.isText || /[\uD800-\uDBFF]/.test(child.text?.charAt(remaining-1)??'')&&/[\uDC00-\uDFFF]/.test(child.text?.charAt(remaining)??'')) valid=false
                    else offset+=Math.min(remaining,child.nodeSize)
                    remaining=0
                }
            })
            result=valid?at+1+offset:null
            return false
        })
        return result
    }
    const from=locate(position.anchor)
    const to=locate(position.head)
    return from!==null&&to!==null ? editor.commands.setTextSelection({from,to}) : false
}
