/**
 * AiBeat — the record of a beat, kept in the manuscript where it was used.
 *
 * A beat is a prompt AND its prose. Keeping only the prose throws half of it
 * away the moment the text is accepted: the instruction that produced the
 * paragraph then exists nowhere the writer can reach. So the instruction lands
 * in the document as its own block, immediately above the prose it asked for,
 * and it survives accept exactly as the prose does.
 *
 * It is part of the generated run, so declining or regenerating takes it away
 * with the text — a beat that did not happen leaves no record.
 *
 * The chapter body is stored as markdown, so this has to round-trip through it.
 * An HTML comment is the one construct that survives every markdown pipeline
 * and renders as nothing everywhere else, which matters because these bodies
 * are also read outside this editor.
 */

import { Node, mergeAttributes, type JSONContent } from '@tiptap/core'

export const AI_BEAT_NODE_NAME = 'aiBeat'

/** `<!-- beat: … -->`, tolerant of the whitespace marked hands us. */
const BEAT_COMMENT = /^<!--\s*beat:\s*([\s\S]*?)\s*-->\s*$/

/**
 * A prompt is free text: it can contain newlines, and it can contain `-->`,
 * which would end the comment early and swallow the rest of the chapter. Both
 * are escaped, and a backslash is escaped first so the decode is unambiguous.
 */
export function encodeBeatPrompt(prompt: string): string {
    return prompt
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/--(?=>)/g, '--\\')
}

export function decodeBeatPrompt(encoded: string): string {
    let out = ''
    for (let index = 0; index < encoded.length; index += 1) {
        const char = encoded[index]
        if (char !== '\\') {
            out += char
            continue
        }
        const next = encoded[index + 1]
        if (next === 'n') {
            out += '\n'
            index += 1
        } else if (next === '\\') {
            out += '\\'
            index += 1
        } else if (next === '>') {
            out += '>'
            index += 1
        } else {
            out += char
        }
    }
    return out
}

export interface AiBeatLabels {
    /** The block's own label, e.g. "Beat". */
    beat: string
    /** Accessible name for the remove control, e.g. "Remove this beat note". */
    remove: string
}

export interface AiBeatOptions {
    /** Read live so a language change reaches nodes already on screen. */
    getLabels: () => AiBeatLabels
}

export const AiBeat = Node.create<AiBeatOptions>({
    name: AI_BEAT_NODE_NAME,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return { getLabels: () => ({ beat: 'Beat', remove: 'Remove' }) }
    },

    addAttributes() {
        return {
            prompt: { default: '' },
        }
    },

    parseHTML() {
        return [{ tag: 'div[data-ai-beat]' }]
    },

    renderHTML({ HTMLAttributes, node }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, { 'data-ai-beat': '', class: 'ai-beat' }),
            String(node.attrs.prompt ?? ''),
        ]
    },

    // marked emits a block-level HTML comment as an `html` token. Returning null
    // for anything that is not ours lets the other registered handlers try.
    markdownTokenName: 'html',

    parseMarkdown(token) {
        const raw = (token as { raw?: string; text?: string }).raw ?? (token as { text?: string }).text ?? ''
        const match = BEAT_COMMENT.exec(raw.trim())
        // Every `html` token reaches every handler; the manager treats a falsy
        // result as "not mine" and tries the next one. The signature says it
        // must return a node, so the miss is cast rather than typed.
        if (!match) return null as unknown as JSONContent
        return { type: AI_BEAT_NODE_NAME, attrs: { prompt: decodeBeatPrompt(match[1]) } }
    },

    renderMarkdown(node) {
        const prompt = (node.attrs?.prompt as string | undefined) ?? ''
        if (!prompt.trim()) return ''
        return `<!-- beat: ${encodeBeatPrompt(prompt)} -->\n\n`
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const labels = this.options.getLabels()
            const dom = document.createElement('div')
            dom.className = 'ai-beat'
            dom.setAttribute('data-ai-beat', '')
            dom.setAttribute('data-testid', 'ai-beat')
            // An atom inside a contenteditable: the browser must not put a caret
            // in it, and ProseMirror must not treat its DOM as content.
            dom.contentEditable = 'false'

            const label = document.createElement('span')
            label.className = 'ai-beat-label'
            label.textContent = labels.beat

            const text = document.createElement('span')
            text.className = 'ai-beat-prompt'
            text.textContent = String(node.attrs.prompt ?? '')
            text.title = String(node.attrs.prompt ?? '')

            const remove = document.createElement('button')
            remove.type = 'button'
            remove.className = 'ai-beat-remove'
            remove.setAttribute('aria-label', labels.remove)
            remove.setAttribute('title', labels.remove)
            remove.setAttribute('data-testid', 'ai-beat-remove')
            remove.textContent = '×'
            remove.addEventListener('mousedown', (event) => event.preventDefault())
            remove.addEventListener('click', (event) => {
                event.preventDefault()
                const pos = typeof getPos === 'function' ? getPos() : null
                if (pos == null) return
                editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize })
            })

            dom.append(label, text, remove)
            return { dom }
        }
    },
})
