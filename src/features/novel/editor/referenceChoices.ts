import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { TriggerMatch } from '@/features/lorebook/loreTriggers'
import type { EditorCodexEntry } from './types'
import { CODEX_MENTION_NAME } from './extensions/codexMention'
import { DETECTION_PLUGIN_KEY } from './extensions/detection'

export interface ManuscriptReferenceChoice {
    key: string
    id: string
    label: string
    kind: 'saved' | 'detected' | 'lore' | 'candidate'
    match?: TriggerMatch
}

/** Inspect identities at the cursor or in the selection; never resolve by label. */
export function referenceChoices(editor: Editor, position?: number): ManuscriptReferenceChoice[] {
    if (editor.isDestroyed) return []
    const { doc, selection } = editor.state
    const from = position ?? selection.from, to = position ?? selection.to
    if (from < 0 || to > doc.content.size) return []
    const choices = new Map<string, { choice: ManuscriptReferenceChoice; position: number }>()
    const saved = (node: PMNode | null, position: number) => {
        if (node?.type.name !== CODEX_MENTION_NAME || typeof node.attrs.id !== 'string') return
        const id = node.attrs.id as string
        if (!choices.has(`codex:${id}`)) choices.set(`codex:${id}`, { choice: { key: `codex:${id}`, id, label: String(node.attrs.label ?? id), kind: 'saved' }, position })
    }
    if (from === to) {
        const cursor = doc.resolve(from)
        saved(cursor.nodeAfter, from); saved(cursor.nodeBefore, from - (cursor.nodeBefore?.nodeSize ?? 0))
    } else {
        doc.nodesBetween(from, to, (node, position) => { saved(node, position) })
    }
    for (const hit of DETECTION_PLUGIN_KEY.getState(editor.state)?.hits ?? []) {
        const overlaps = from === to ? from >= hit.from && from <= hit.to : from < hit.to && to > hit.from
        if (!overlaps) continue
        if (hit.kind === 'name' && hit.codexId) {
            const key = `codex:${hit.codexId}`
            if (!choices.has(key)) choices.set(key, { choice: { key, id: hit.codexId, label: doc.textBetween(hit.from, hit.to), kind: 'detected' }, position: hit.from })
        } else if (hit.match) {
            const key = `lore:${hit.match.entry.lorebookId}:${hit.match.entry.id}`
            if (!choices.has(key)) choices.set(key, { choice: { key, id: hit.match.entry.id, label: hit.match.entry.title, kind: 'lore', match: hit.match }, position: hit.from })
        }
    }
    return [...choices.values()].sort((a, b) => a.position - b.position).map(({ choice }) => choice)
}

/** Current manuscript use, then recent choices, then pinned sources. Stable ties. */
const mentionIndex = new WeakMap<PMNode, ReadonlySet<string>>()
const NO_MENTIONS: ReadonlySet<string> = new Set()
function manuscriptMentions(node: PMNode): ReadonlySet<string> {
    if (node.isText) return NO_MENTIONS
    const cached = mentionIndex.get(node)
    if (cached) return cached
    const used = new Set<string>()
    if (node.type.name === CODEX_MENTION_NAME) used.add(String(node.attrs.id))
    else node.forEach((child) => { for (const id of manuscriptMentions(child)) used.add(id) })
    const result = used.size ? used : NO_MENTIONS
    mentionIndex.set(node, result)
    return result
}

export function mentionChoices(entries: EditorCodexEntry[], doc: PMNode | null, query: string, recent: readonly string[] = []): EditorCodexEntry[] {
    const used = doc ? manuscriptMentions(doc) : NO_MENTIONS
    const needle = query.trim().toLocaleLowerCase()
    return entries.filter((entry) => !entry.removed && [entry.label, ...(entry.aliases ?? []), entry.description, entry.sourceId, entry.sourceVersionNumber, entry.scopeLabel].filter((value) => value != null).join(' ').toLocaleLowerCase().includes(needle))
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => Number(used.has(b.entry.id)) - Number(used.has(a.entry.id))
            || (recent.includes(a.entry.id) ? recent.indexOf(a.entry.id) : Infinity) - (recent.includes(b.entry.id) ? recent.indexOf(b.entry.id) : Infinity)
            || Number(Boolean(b.entry.sourceVersionId)) - Number(Boolean(a.entry.sourceVersionId)) || a.index - b.index)
        .map(({ entry }) => entry)
}
