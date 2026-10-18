import type { Editor } from '@tiptap/core'
import { Fragment, NodeRange, type Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection, type Selection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { generateUUID } from '@/utils/uuid'
import { isStoryDocument, nodeText, normalizeEditorDocument } from '@/shared/storyDocument'

export const BLOCK_MOVE_META = 'manuscriptBlockMove'
export interface BlockMoveOption { id: string; index: number; position: number; size: number; kind: string; excerpt: string }
export interface BlockMoveTarget {
    id: string
    editor: Editor
    document: PMNode
    selection: Selection
    from: number
    to: number
    fragment: Fragment
    parentKind: string
    selected: BlockMoveOption[]
    destinations: BlockMoveOption[]
    previous: string | null
    next: string | null
}
export type BlockMoveResult = 'moved' | 'stale' | 'blocked' | 'boundary' | 'invalid'

/** Lists move whole items with their nested content. Other containers move the
 * complete sibling blocks touched by the selection, including its endpoints. */
export function captureBlockMove(editor: Editor): BlockMoveTarget | null {
    if (editor.isDestroyed) return null
    const { doc, selection } = editor.state
    if (!(selection instanceof TextSelection || selection instanceof NodeSelection)) return null
    const { $from, $to } = selection
    let range = $from.blockRange($to)
    if (!range) return null
    for (let depth = $from.depth; depth > 0; depth--) {
        if (['bulletList', 'orderedList'].includes($from.node(depth).type.name) && depth <= $to.depth && $from.node(depth) === $to.node(depth)) {
            range = new NodeRange($from, $to, depth); break
        }
    }
    const start = range.startIndex, end = range.endIndex
    if (end <= start) return null
    const options: BlockMoveOption[] = [], seen = new Set<string>()
    let valid = true
    range.parent.forEach((node, offset, index) => {
        const id = node.attrs.nodeId
        if (typeof id !== 'string' || !id || seen.has(id)) { valid = false; return }
        seen.add(id)
        const text = node.type.name === 'aiBeat' ? String(node.attrs.prompt ?? '') : nodeText(node.toJSON())
        const excerpt = Array.from(text).slice(0, 160).join('')
        options.push({ id, index, position: $from.start(range.depth) + offset, size: node.nodeSize, kind: node.type.name, excerpt: excerpt + (excerpt.length < text.length ? '…' : '') })
    })
    if (!valid || options.length !== range.parent.childCount) return null
    const selected = options.slice(start, end)
    return {
        id: generateUUID(), editor, document: doc, selection, from: range.start, to: range.end,
        fragment: doc.slice(range.start, range.end).content, parentKind: range.parent.type.name,
        selected, destinations: options.filter((option) => option.index < start || option.index >= end),
        previous: options[start - 1]?.id ?? null, next: options[end]?.id ?? null,
    }
}

export function blockMoveCurrent(target: BlockMoveTarget): boolean {
    return !target.editor.isDestroyed && target.editor.state.doc === target.document && target.editor.state.selection.eq(target.selection)
}

/** One real delete/insert transaction reuses complete nodes and their identities.
 * No Markdown, DOM copy, text matching or client-created anchor lineage. */
export function applyBlockMove(target: BlockMoveTarget, destinationId: string, side: 'before' | 'after', canWrite: () => boolean): BlockMoveResult {
    if (!canWrite() || target.editor.isDestroyed || !target.editor.isEditable) return 'blocked'
    if (!blockMoveCurrent(target)) return 'stale'
    const destination = target.destinations.find((option) => option.id === destinationId)
    if (!destination || (side !== 'before' && side !== 'after')) return 'invalid'
    const at = destination.position + (side === 'after' ? destination.size : 0)
    if (at === target.from || at === target.to) return 'boundary'
    const insertAt = at > target.to ? at - target.fragment.size : at
    let tr
    try {
        tr = target.editor.state.tr.delete(target.from, target.to).insert(insertAt, target.fragment)
        tr.doc.check()
        if (!isStoryDocument({ schemaVersion: 1, content: normalizeEditorDocument(tr.doc.toJSON()) })) return 'invalid'
        const { selection } = target
        tr.setSelection(selection instanceof NodeSelection ? NodeSelection.create(tr.doc, insertAt + selection.from - target.from)
            : TextSelection.create(tr.doc, insertAt + selection.anchor - target.from, insertAt + selection.head - target.from))
        closeHistory(tr).setMeta(BLOCK_MOVE_META, true)
    } catch { return 'invalid' }
    if (!canWrite() || !target.editor.isEditable) return 'blocked'
    if (!blockMoveCurrent(target)) return 'stale'
    target.editor.view.dispatch(tr.scrollIntoView())
    return 'moved'
}

export function moveBlockAdjacent(target: BlockMoveTarget, direction: 'up' | 'down', canWrite: () => boolean): BlockMoveResult {
    if (!canWrite() || target.editor.isDestroyed || !target.editor.isEditable) return 'blocked'
    if (!blockMoveCurrent(target)) return 'stale'
    const id = direction === 'up' ? target.previous : target.next
    return id ? applyBlockMove(target, id, direction === 'up' ? 'before' : 'after', canWrite) : 'boundary'
}
