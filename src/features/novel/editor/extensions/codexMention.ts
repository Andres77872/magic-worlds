/** Canonical mentions persist their reference IDs in scene JSON. Markdown is
 * an explicit import/projection boundary; ambiguous labels stay plain text. */

import type { MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import type { EditorCodexEntry } from '../types'

export const CODEX_MENTION_NAME = 'codexMention'

type CodexMentionToken = MarkdownToken & {
    entryId: string
    entryLabel: string
    entryKind: string
}

/** Longest case-insensitive label match at the head of `text` (after '@'). */
function matchEntry(text: string, entries: EditorCodexEntry[]): { entry: EditorCodexEntry; matched: string } | null {
    let best: { entry: EditorCodexEntry; matched: string } | null = null
    let ambiguous=false
    for (const entry of entries) {
        const label = entry.label.trim()
        if (!label) continue
        const candidate = text.slice(0, label.length)
        if (candidate.toLowerCase() !== label.toLowerCase()) continue
        const after = text.charAt(label.length)
        if (after && /[\p{L}\p{N}_@]/u.test(after)) continue
        if (!best || label.length > best.entry.label.trim().length){best={entry,matched:candidate};ambiguous=false}
        else if(label.length===best.entry.label.trim().length&&entry.id!==best.entry.id)ambiguous=true
    }
    return ambiguous?null:best
}

export function createCodexMention(getEntries: () => EditorCodexEntry[]) {
    return Mention.extend({
        name: CODEX_MENTION_NAME,

        // --- markdown round-trip (overrides the stock shortcode spec) ---
        markdownTokenName: CODEX_MENTION_NAME,
        renderMarkdown(node: { attrs?: { label?: string | null; id?: string | null } }) {
            return `@${node.attrs?.label ?? node.attrs?.id ?? ''}`
        },
        parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
            const mention = token as CodexMentionToken
            return helpers.createNode(CODEX_MENTION_NAME, { id: mention.entryId, label: mention.entryLabel })
        },
        markdownTokenizer: {
            name: CODEX_MENTION_NAME,
            level: 'inline',
            start: (src: string) => src.indexOf('@'),
            tokenize(src: string): CodexMentionToken | undefined {
                if (!src.startsWith('@')) return undefined
                const match = matchEntry(src.slice(1), getEntries())
                if (!match) return undefined
                return {
                    type: CODEX_MENTION_NAME,
                    raw: `@${match.matched}`,
                    entryId: match.entry.id,
                    entryLabel: match.entry.label,
                    entryKind: match.entry.kind,
                }
            },
        },
    })
}
