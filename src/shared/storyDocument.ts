import { generateUUID } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'
import type { StoryDocumentNode, StoryManuscriptDocument } from './types/story.types'

export const MANUSCRIPT_BLOCKS = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'horizontalRule', 'aiBeat']

/** Discard only a neutral native editor default that is absent from the wire
 * schema. Meaningful unsupported attributes remain visible to validation. */
export function normalizeEditorDocument(content: StoryDocumentNode): StoryDocumentNode {
    const result = structuredClone(content)
    const visit = (node: StoryDocumentNode) => {
        if (node.type === 'orderedList' && node.attrs?.type === null) delete node.attrs.type
        node.content?.forEach(visit)
    }
    visit(result)
    return result
}

/** New/imported blocks receive identities; existing identities survive edits. */
export function identifyDocument(content: StoryDocumentNode): StoryManuscriptDocument {
    const result = normalizeEditorDocument(content)
    const seen = new Set<string>()
    const visit = (node: StoryDocumentNode) => {
        if (MANUSCRIPT_BLOCKS.includes(node.type ?? '')) {
            const original = node.attrs?.nodeId
            const nodeId = typeof original === 'string' && original && !seen.has(original) ? original : generateUUID()
            node.attrs = { ...node.attrs, nodeId }
            seen.add(nodeId)
        }
        node.content?.forEach(visit)
    }
    visit(result)
    return { schemaVersion: 1, content: result }
}

function escapeMarkdown(value: string): string {
    return value.replace(/[\\`*_{}[\]<>~]/g, '\\$&')
}
function project(node: StoryDocumentNode, markdown: boolean): string {
    const kind = node.type
    const attrs = node.attrs ?? {}
    let value: string
    if (kind === 'text') value = markdown ? escapeMarkdown(node.text ?? '') : node.text ?? ''
    else if (kind === 'codexMention') value = '@' + (markdown ? escapeMarkdown(String(attrs.label ?? attrs.id ?? '')) : String(attrs.label ?? attrs.id ?? ''))
    else if (kind === 'hardBreak') return markdown ? '  \n' : '\n'
    else if (kind === 'horizontalRule') return markdown ? '---' : ''
    else if (kind === 'aiBeat') return markdown ? `<!-- beat: ${String(attrs.prompt ?? '').replace(/--/g, '—')} -->` : ''
    else {
        const children = node.content ?? []
        const separator = kind === 'paragraph' || kind === 'heading' ? '' : kind === 'bulletList' || kind === 'orderedList' ? '\n' : '\n\n'
        value = children.map((child) => project(child, markdown)).join(separator)
        if (markdown && kind === 'heading') value = '#'.repeat(Number(attrs.level)) + ' ' + value
        if (markdown && kind === 'blockquote') value = value.split('\n').map((line) => '> ' + line).join('\n')
        if (markdown && (kind === 'bulletList' || kind === 'orderedList')) {
            value = children.map((child, index) => {
                const prefix = kind === 'bulletList' ? '- ' : `${Number(attrs.start ?? 1) + index}. `
                const [first, ...rest] = project(child, true).split('\n')
                return prefix + first + rest.map((line) => '\n' + ' '.repeat(prefix.length) + line).join('')
            }).join('\n')
        }
    }
    if (markdown) {
        if(node.marks?.some(mark=>mark.type==='highlight'))value=value.replace(/&/g,'&amp;')
        for (const mark of node.marks ?? []) {
            if(mark.type==='highlight')value='<mark>'+value+'</mark>'
            else if (mark.type === 'link') {
                const destination = String(mark.attrs?.href ?? '').replace(/\(/g, '%28').replace(/\)/g, '%29')
                const title = mark.attrs?.title
                value = `[${value}](${destination}${title ? ` "${String(title).replace(/"/g, '\\"')}"` : ''})`
            } else {
                const delimiter = ({ bold: '**', italic: '*', strike: '~~' } as Record<string, string>)[mark.type]
                if (delimiter) value = delimiter + value + delimiter
            }
        }
    }
    return value
}

export const documentText = (document: StoryManuscriptDocument): string => project(document.content, false)
export const documentMarkdown = (document: StoryManuscriptDocument): string => project(document.content, true)

export const nodeText = (node: StoryDocumentNode): string => project(node, false)
/** JSON object key order is not manuscript identity. Arrays retain their order. */
export const documentSignature = (document: StoryManuscriptDocument): string => canonicalJson(document)

/** Reject unsupported saved content instead of normalizing it into an empty doc. */
export function isStoryDocument(value: unknown): value is StoryManuscriptDocument {
    const object = (input: unknown): input is Record<string, unknown> => Boolean(input && typeof input === 'object' && !Array.isArray(input))
    if (!object(value) || value.schemaVersion !== 1 || Object.keys(value).some((key) => !['schemaVersion','content'].includes(key))) return false
    try {
        if (new TextEncoder().encode(JSON.stringify(value)).length > 2_000_000) return false
        const seen = new Set<string>()
        let count = 0
        const visit = (node: unknown, parent: string | null, depth: number): boolean => {
            count += 1
            if (count > 100_000 || depth > 64 || !object(node) || Object.keys(node).some((key) => !['type','attrs','content','text','marks'].includes(key))) return false
            const kind = node.type
            const allowed = parent === null ? ['doc'] : ['paragraph','heading'].includes(parent) ? ['text','hardBreak','codexMention'] : ['bulletList','orderedList'].includes(parent) ? ['listItem'] : MANUSCRIPT_BLOCKS.filter((type) => type !== 'listItem')
            if (typeof kind !== 'string' || !allowed.includes(kind)) return false
            const attrs = node.attrs === undefined ? {} : node.attrs
            if (!object(attrs)) return false
            const attributes = ({ heading:['level'], orderedList:['start'], codexMention:['id','label','mentionSuggestionChar'], aiBeat:['prompt'] } as Record<string,string[]>)[kind] ?? []
            if (Object.keys(attrs).some((key) => !attributes.includes(key) && !(key === 'nodeId' && MANUSCRIPT_BLOCKS.includes(kind)))) return false
            if (MANUSCRIPT_BLOCKS.includes(kind)) {
                if (typeof attrs.nodeId !== 'string' || !attrs.nodeId || attrs.nodeId.length > 64 || seen.has(attrs.nodeId)) return false
                seen.add(attrs.nodeId)
            }
            if (kind === 'heading' && (typeof attrs.level!=='number'||![1,2,3].includes(attrs.level))) return false
            if (kind === 'orderedList' && attrs.start !== undefined && (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 1_000_000)) return false
            if (kind === 'codexMention' && (typeof attrs.id !== 'string' || !attrs.id || attrs.id.length > 64 || typeof attrs.label !== 'string' || !attrs.label || attrs.label.length > 255)) return false
            if (kind === 'aiBeat' && (typeof attrs.prompt !== 'string' || attrs.prompt.length > 20_000)) return false
            if (kind === 'text' ? typeof node.text !== 'string' || !node.text || 'content' in node || Object.keys(attrs).length > 0 : 'text' in node) return false
            const marks = node.marks ?? []
            if (!Array.isArray(marks) || (marks.length > 0 && !['text','codexMention'].includes(kind))) return false
            const markTypes = new Set<string>()
            for (const mark of marks) {
                if (!object(mark) || typeof mark.type !== 'string' || !['bold','italic','strike','link','highlight'].includes(mark.type) || markTypes.has(mark.type) || Object.keys(mark).some((key) => !['type','attrs'].includes(key))) return false
                markTypes.add(mark.type)
                const properties = mark.attrs === undefined ? {} : mark.attrs
                if (!object(properties)) return false
                if (mark.type === 'link') {
                    if (Object.keys(properties).some((key) => !['href','title','target','rel','class'].includes(key)) || typeof properties.href !== 'string' || properties.href.length > 4096 || Array.from(properties.href).some((character)=>character.charCodeAt(0)<=32) || !/^(https?:|mailto:|tel:)/i.test(properties.href)) return false
                    if (properties.title != null && (typeof properties.title !== 'string' || properties.title.length > 4096)) return false
                } else if (Object.keys(properties).length > 0) return false
            }
            const children = node.content ?? []
            if (!Array.isArray(children) || (children.length > 0 && ['text','hardBreak','horizontalRule','codexMention','aiBeat'].includes(kind))) return false
            if (['doc','blockquote','listItem','bulletList','orderedList'].includes(kind) && children.length === 0) return false
            if (kind === 'listItem' && (!object(children[0]) || children[0].type !== 'paragraph')) return false
            return children.every((child) => visit(child, kind, depth + 1))
        }
        return visit(value.content, null, 0)
    } catch { return false }
}
