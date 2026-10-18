import { generateUUID } from '@/utils/uuid'
import { Extension } from '@tiptap/core'
import { Plugin, type Transaction } from '@tiptap/pm/state'
import { MANUSCRIPT_BLOCKS } from '../manuscript'

/** Normalize new block identities inside an already-owned manuscript event. */
export function identifyManuscriptTransaction(tr: Transaction): Transaction {
    const seen = new Set<string>()
    tr.doc.descendants((node, position) => {
        if (!MANUSCRIPT_BLOCKS.includes(node.type.name) || !('nodeId' in node.attrs)) return
        const identity = node.attrs.nodeId
        const id = typeof identity === 'string' && identity && !seen.has(identity) ? identity : generateUUID()
        seen.add(id)
        if (id !== identity) tr.setNodeMarkup(position, undefined, { ...node.attrs, nodeId: id }, node.marks)
    })
    return tr
}

/** Assign IDs in the same history event as inserted/pasted manuscript blocks. */
export const ManuscriptIdentity = Extension.create({
    name: 'manuscriptIdentity',
    addGlobalAttributes: () => [{ types: MANUSCRIPT_BLOCKS, attributes: {
        nodeId: { default: null, parseHTML: () => null, rendered: false },
    } }],
    addProseMirrorPlugins: () => [new Plugin({
        appendTransaction(transactions, _previous, state) {
            if (!transactions.some((transaction) => transaction.docChanged)) return null
            const tr = identifyManuscriptTransaction(state.tr)
            return tr.docChanged ? tr : null
        },
    })],
})
